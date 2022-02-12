var vid = document.getElementById("clip");
var button = document.getElementById("pb");

function play_pause(){
    if(vid.paused){
        vid.play();
        button.innerHTML = '||';
    }
    else if (vid.played){
        vid.pause();
        button.innerHTML = '▶';
    }
}