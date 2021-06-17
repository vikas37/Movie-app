
//function to convert minutes into days, hours and minutes
exports.getWatchedTime = function(all_movies){
  let time = 0;
  all_movies.forEach(function(movie){
    time += movie.runtime;
  });
  let s = '';
  if(Math.floor((time/60)/24) > 0)
      s += Math.floor((time/60)/24) + " Days ";
  if(Math.floor((time/60)%24) > 0)
      s += Math.floor((time/60)%24) + " Hrs ";
  if(time%60 > 0)
      s += time%60 + " Mins";
  return s;
}

//function to know whether movie has been released or not
exports.isReleased = function(date){
  var today = new Date();
  var t = new Date(today.getFullYear()+','+(today.getMonth()+1)+','+today.getDate());
  var r = new Date(date);
  if(r == 'Invalid Date')
      return true;
  else
    return t > r;
}
