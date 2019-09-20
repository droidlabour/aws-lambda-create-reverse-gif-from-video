var ffmpeg = require('fluent-ffmpeg');

/*
ffmpeg.getAvailableFormats(function(err, formats) {
  console.log('Available formats:');
  console.dir(formats);
});
*/

ffmpeg()
	.input('/Users/droidlabour/Downloads/10-second-video-fail-452824.mp4')
	.seekInput(7)
	.inputOptions('-t 2')
	.addOutputOption('-f gif')
	.on('start', function(cmd) {
		console.log('Beginning gif creation:\n\t' + cmd);
	})
	.on('end', function() {
		console.log('GIF created');
	})
	.on('error', function(error) {
		console.log('ERROR creating gif: ' + error);
	})
	.output('/Users/droidlabour/Downloads/2.gif')
	.run();
