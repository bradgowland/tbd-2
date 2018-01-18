// node modules
var socket = io();

// TODO: if you want to list rooms, return them from the server
var rooms =  [];

// page interaction
$(document).ready(function(){

	// check for room joined by url
	var url = window.location.href;

	// TODO: snag the room name, check that it isn't empty append to url, redirect
	$('#roomButton').click(function() {
			roomID = $("#roomName").val();

			if (roomID != "") {
				window.location.href = url + roomID;
			} else {
				$('#prompt').text("You have to enter a room name!");
			}
	});
});
