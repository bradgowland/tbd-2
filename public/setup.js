$(document).ready(function(){

  $('#ableton_download').click(function() {
			$('#abletonRoom').modal('show');
  });
	$('#flstudio_download').click(function() {
			$('#flstudioRoom').modal('show');
  });
	$('#reaper_download').click(function() {
			$('#reaperRoom').modal('show');
  });

	// snag the room name, append daw for special session init, redirect
	$('#abletonRoomButton').click(function() {
			roomID = "ableton-" + $("#abletonRoomName").val();
			// clean up url
			var url = window.location.href;
			url = url.replace("setup","");
			url = url.replace("#connect","");
			url = url.replace("#ableton","");
			url = url.replace("#flstudio","");
			url = url.replace("#reaper","");
			window.location.href = url + roomID;
	});
	$('#flRoomButton').click(function() {
			roomID = "flstudio-" + $("#flRoomName").val();
			// clean up url
			var url = window.location.href;
			url = url.replace("setup","");
			url = url.replace("#connect","");
			url = url.replace("#ableton","");
			url = url.replace("#flstudio","");
			url = url.replace("#reaper","");
			window.location.href = url + roomID;
	});
	$('#reaperRoomButton').click(function() {
			roomID = "reaper-" + $("#reaperRoomName").val();
			// clean up url
			var url = window.location.href;
			url = url.replace("setup","");
			url = url.replace("#connect","");
			url = url.replace("#ableton","");
			url = url.replace("#flstudio","");
			url = url.replace("#reaper","");
			window.location.href = url + roomID;
	});
});
