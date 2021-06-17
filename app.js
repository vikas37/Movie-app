// jshint esversion: 6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const axios = require('axios');
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const functions = require(__dirname+"/functions.js");

const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(session({
  secret: "This is movie secret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next){
  res.locals.isAuth = req.isAuthenticated();
  next();
});

// ###############################  mongoose DB connection ###################################

mongoose.connect("mongodb://localhost:27017/movieDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);
mongoose.set('useFindAndModify', false);

// ###############################  DB schemas ###################################

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: String,
  contact: String
});

const movieSchema = new mongoose.Schema({
  runtime: Number,
  posterPath: String,
  movieId: String,
  title: String,
  overview: String
});

const userMovies = new mongoose.Schema({
  user: userSchema,
  watched: [movieSchema],
  wished: [movieSchema]
});

const options = {
  usernameField: 'email',
  errorMessages: {
    MissingPasswordError: 'No password was given',
    AttemptTooSoonError: 'Account is currently locked. Try again later',
    TooManyAttemptsError: 'Account locked due to too many failed login attempts',
    NoSaltValueStoredError: 'Authentication not possible.',
    IncorrectPasswordError: 'Password or username are incorrect',
    IncorrectUsernameError: 'Password or username are incorrect',
    MissingUsernameError: 'No Email was given',
    UserExistsError: 'Email is already registered'
  }
};

userSchema.plugin(passportLocalMongoose, options);

// ###############################  mongoose DB models ###################################

const User = mongoose.model("User", userSchema);
const Movie = mongoose.model("Movie", movieSchema);
const UserMovie = mongoose.model("UserMovie", userMovies);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ########################### home / route ##########################################

app.get("/", function(req, res){

  axios.get("https://api.themoviedb.org/3/movie/upcoming?api_key=7719d9fc54bec69adbe2d6cee6d93a0d&language=en-US&page=1")
  .then((response_upcoming) => {
    const upcoming_movies = response_upcoming.data.results;
    axios.get("https://api.themoviedb.org/3/movie/top_rated?api_key=7719d9fc54bec69adbe2d6cee6d93a0d&language=en-US&page=1")
    .then((response_toprated) => {
      const toprated_movies = response_toprated.data.results;
      res.render("home", {upcoming: upcoming_movies, toprated: toprated_movies});
    })
    .catch((err) => {
      console.log(err);
    });
  })
  .catch((err) => {
    console.log(err);
  });
});

// ########################### searchMovies /search route ##########################################

app.post("/search", function(req, res){
  const searchText = req.body.searchText;
  axios.get('https://api.themoviedb.org/3/search/movie?api_key=7719d9fc54bec69adbe2d6cee6d93a0d&query='+searchText)
  .then((response) => {
    const movies = response.data.results;
    res.render("searchMovies", {movies: movies});
  })
  .catch((err) => {
    console.log(err);
  });
});

// ########################### moviedetails /movie/movieId route ##########################################

app.get("/movie/:movieId", function(req, res){
  const movieId = req.params.movieId;
  axios.get('https://api.themoviedb.org/3/movie/'+movieId+'?api_key=7719d9fc54bec69adbe2d6cee6d93a0d&language=en-US')
  .then((response) => {
    const imdbId = response.data.imdb_id;
    axios.get('http://www.omdbapi.com?apikey=c1c12a90&i='+imdbId)
    .then((imdbResponse) => {
      const movie = imdbResponse.data;
      axios.get('https://api.themoviedb.org/3/movie/'+movieId+'/recommendations?api_key=7719d9fc54bec69adbe2d6cee6d93a0d&language=en-US&page=1')
      .then((similarResponse) => {
        const allSimilarMovies = similarResponse.data.results;
        const similarMovies = allSimilarMovies.length > 4 ? allSimilarMovies.slice(0, 4) : allSimilarMovies;
        res.render("movieDetails", {movie: movie, id: movieId, similarMovies: similarMovies});
      })
      .catch((err) => {
        console.log(err);
      });
    })
    .catch((err) => {
      console.log(err);
    });
  })
  .catch((err) => {
    console.log(err);
  });
  // res.render("movieDetails");
});

// ########################### login /login route ##########################################

app.get("/login", function(req, res){
  if(req.isAuthenticated()){
    res.redirect("/");
  }
  else{
    const email = req.query.email;
    console.log(email);
    res.render("login", {error: null, email: email});
  }
});

app.post("/login", function(req, res){
  if(!req.body.email){
    res.render("login", {error: "Please provide email", email: null});
  } else {
    if(!req.body.password){
      res.render("login", {error: "Please provide password", email: null});
    } else {
      passport.authenticate('local', function(err, user, info){
        if(err){
          res.render("login", {error: "Login failed! Try Again", email: null});
        } else {
          if(!user){
            res.render("login", {error: "Email or password incorrect", email: null});
          } else {
            req.login(user, function(err){
              if(err){
                res.render("login", {error: "Login failed! Try Again", email: null});
              }
              else{
                res.redirect("/");
              }
            });
          }
        }
      })(req, res);
    }
  }
});

// ########################### register /register route ##########################################

app.get("/register", function(req, res){
  if(req.isAuthenticated()){
    res.redirect("/");
  }
  else{
    res.render("signUp", {error: null});
  }
});

app.post("/register", function(req, res){
  User.register(
    {name: req.body.name, email: req.body.email, contact: req.body.contact},
    req.body.password,
    function(err, user){
      if(err){
        res.render("signUp", {error: err});
      }
      else{
        res.redirect("/login/?email="+user.email);
      }
    });
});

// ########################### logout /logout ##########################################

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

// ########################### add watched movies /addMovie ##########################################

app.get("/watchList", function(req, res){
  if(req.isAuthenticated()){
    UserMovie.findOne({user: req.user}, function(err, foundUser){
      if(!err){
        if(!foundUser){
          const arr = new Array();
          res.render("watchList", {movies: arr, runtime: 0});
        }
        else{
          const time = functions.getWatchedTime(foundUser.watched);
          res.render("watchList", {movies: foundUser.watched, runtime: time});
        }
      }
    });
  }
  else{
    res.redirect("/");
  }
});

app.get("/addWatched/:movieId", function(req, res){
  const movieId = req.params.movieId;
  if(req.isAuthenticated()){
    axios.get('https://api.themoviedb.org/3/movie/'+movieId+'?api_key=7719d9fc54bec69adbe2d6cee6d93a0d&language=en-US')
    .then((response) => {
      const movie = response.data;
      const newMovie = new Movie({
        runtime: movie.runtime,
        posterPath: movie.poster_path,
        movieId: movie.id,
        title: movie.title,
        overview: movie.overview
      });
      UserMovie.findOne({user: req.user}, function(err, foundUser){
        if(!err){
          if(!foundUser){
            const newUserMovie = new UserMovie({
              user: req.user,
              watched: [newMovie],
              wished: []
            });
            newUserMovie.save();
            res.status(204).send();
          }
          else{
            let seenMovie = foundUser.watched.find(movie => movie.movieId === newMovie.movieId);
            if(!seenMovie){
              foundUser.watched.push(newMovie);
              foundUser.save();
            }
            res.status(204).send();
          }
        }
      });
    })
    .catch((err) => {
      console.log(err);
    });
  }
  else{
    res.redirect("/login");
  }
});

// ########################### add wished movies /addMovie ##########################################

app.get("/wishList", function(req, res){
  if(req.isAuthenticated()){
    UserMovie.findOne({user: req.user}, function(err, foundUser){
      if(!err){
        if(!foundUser){
          const arr = new Array();
          res.render("wishList", {movies: arr});
        }
        else{
          res.render("wishList", {movies: foundUser.wished});
        }
      }
    });
  }
  else{
    res.redirect("/");
  }
});

app.get("/addWished/:movieId", function(req, res){
  const movieId = req.params.movieId;
  if(req.isAuthenticated()){
    axios.get('https://api.themoviedb.org/3/movie/'+movieId+'?api_key=7719d9fc54bec69adbe2d6cee6d93a0d&language=en-US')
    .then((response) => {
      const movie = response.data;
      const newMovie = new Movie({
        runtime: movie.runtime,
        posterPath: movie.poster_path,
        movieId: movie.id,
        title: movie.title,
        overview: movie.overview
      });
      UserMovie.findOne({user: req.user}, function(err, foundUser){
        if(!err){
          if(!foundUser){
            const newUserMovie = new UserMovie({
              user: req.user,
              wished: [],
              wished: [newMovie]
            });
            newUserMovie.save();
            res.status(204).send();
          }
          else{
            let seenMovie = foundUser.wished.find(movie => movie.movieId === newMovie.movieId);
            if(!seenMovie){
              foundUser.wished.push(newMovie);
              foundUser.save();
            }
            res.status(204).send();
          }
        }
      });
    })
    .catch((err) => {
      console.log(err);
    });
  }
  else{
    res.redirect("/login");
  }
});

// ########################### delete movie /delete/:movieId/:num #################################

app.get("/delete/:movieId/:num", function(req, res){
  if(req.isAuthenticated()){
    const movieId = req.params.movieId;
    const num = req.params.num;
    if(num == 1){
      UserMovie.findOneAndUpdate({user: req.user}, {$pull: {watched: {movieId: movieId}}}, function(err, foundMovie){
        if(!err){
          res.redirect("/watchList");
        }
      });
    }
    else{
      UserMovie.findOneAndUpdate({user: req.user}, {$pull: {wished: {movieId: movieId}}}, function(err, foundMovie){
        if(!err){
          res.redirect("/wishList");
        }
      });
    }
  }
  else{
    res.redirect("/login");
  }
});

// ######################## swich to watch /toWatchList/:movieId #############################

app.get("/toWatchList/:movieId", function(req, res){
  const movieId = req.params.movieId;
  if(req.isAuthenticated()){
    UserMovie.findOne({user: req.user}, function(err, foundUser){
      if(!err){
        const wishedMovie = foundUser.wished.find(movie => movie.movieId === movieId);
        if(wishedMovie){
          const seenMovie = foundUser.watched.find(movie => movie.movieId === movieId);
          if(!seenMovie){
            foundUser.watched.push(wishedMovie);
            foundUser.save();
          }
          UserMovie.findOneAndUpdate({user: req.user}, {$pull: {wished: {movieId: movieId}}}, function(err, foundMovie){
            if(!err){
              res.redirect("/wishList");
            }
          });
        }
        else{
          res.redirect("/wishList");
        }
      }
    });
  }
  else{
    res.redirect("/login");
  }
});

// ########################### server listen ##########################################

app.listen(3000, function(req, res){
  console.log("Server is running at port 3000");
});
