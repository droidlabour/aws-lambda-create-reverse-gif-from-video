var ffmpeg = require('fluent-ffmpeg');

ffmpeg()
	.input('/Users/droidlabour/Downloads/10-second-video-fail-452824.mp4')
	.seekInput(2)
	.inputOptions('-t 2')
	.addOutputOption('-f gif')
	.on('start', function(cmd) {
		console.log('Beginning gif creation:\n\t' + cmd);
	})
	.on('end', function() {
		console.log('GIF created');
		reverse.run();
	})
	.on('error', function(error) {
		console.log('ERROR creating gif: ' + error);
	})
	.output('/Users/droidlabour/Downloads/1.gif')
	.run();

// Convert video to gif & concat with itself in reverse order
// https://stackoverflow.com/questions/42257354/concat-a-video-with-itself-but-in-reverse-using-ffmpeg#comment79872823_42257863
// ffmpeg -i 2.gif -filter_complex "[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]" -map "[v]" merge.gif

var reverse = ffmpeg()
	.input('/Users/droidlabour/Downloads/1.gif')
	.complexFilter('[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]', ['v'])
	.on('start', function(cmd) {
		console.log('Reversing gif:\n\t' + cmd);
	})
	.on('end', function() {
		console.log('GIF reversed');
	})
	.on('error', function(error) {
		console.log('ERROR reversing gif: ' + error);
	})
	.output('/Users/droidlabour/Downloads/reverse.gif');
