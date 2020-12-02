$(function() {
    let Video = function(videoId) {
        this.id = videoId;
    };
    Video.prototype = {
        subtitlesUrl: 'https://video.google.com/timedtext?lang=en&v=',

        onPlayerStateChange: function(event) {
            // console.log(event);
        },

        loadPlayer: function(embedTo) {
            embedTo.append('<div id="player"></div>')
            this.player = new YT.Player('player', {
                videoId: this.id,
                width: '100%',
                events: {
                    onReady: e => {
                        this.loaded = true
                    },
                    onStateChange: this.onPlayerStateChange
                }
            });
        },

        decode: function(text) {
            let textarea = document.createElement('textarea');
            textarea.innerHTML = text;
            return textarea.value;
        },

        loadSubtitles: function(embedTo) {
            $.ajax({
                type: 'POST',
                url: this.subtitlesUrl + this.id,
                success: data => {
                    let lines = $('<div class="lines"></div>');
                    let textList = $(data).find('text').map(function() {
                        return $(this).text();
                    }).toArray();

                    textList.forEach(item => {
                        lines.append($('<p class="line"></p>').text(this.decode(item)))
                    });
                    embedTo.append(lines);
                }
            });
        },

        togglePause: function() {
            let state = this.player.getPlayerState();

            if (state == 1) {
                this.player.pauseVideo();
            } else {
                this.player.playVideo();
            }
        },

        relativeSeek: function(delta) {
            let currentTime = this.player.getCurrentTime();
            this.player.seekTo(currentTime + delta, true);
        },

        forward: function() {
            this.relativeSeek(5);
        },

        backward: function() {
            this.relativeSeek(-5);
        },

        changePlaybackRate: function(delta) {
            let currentPlayback = this.player.getPlaybackRate();
            this.player.setPlaybackRate(currentPlayback + delta);
        },

        faster: function() {
            this.changePlaybackRate(0.05);
        },

        slower: function() {
            this.changePlaybackRate(-0.05);
        }
    };


    let Audio = function(list) {
        this.list = list;
        this.reset();
    };
    Audio.prototype = {
        start: function() {
            navigator.mediaDevices.getUserMedia({ 
                audio: true 
            }).then(stream => {
                let audioContext = new AudioContext();
                let input = audioContext.createMediaStreamSource(stream);
                this.stream = stream;
                this.recorder = new Recorder(input, {
                    numChannels: 2
                })
                this.recorder.record();
            });
        },

        togglePause: function() {
            if (!this.recorder) {
                return this.start();
            }

            if (this.recorder.recording) {
                this.recorder.stop();
            } else {
                this.recorder.record();
            }
        },

        stop: function() {
            this.recorder.stop();
            this.stream.getAudioTracks()[0].stop();
            this.recorder.exportWAV(blob => {
                this.export(blob);
                this.reset();
            });
        },

        export: function(blob) {
            let url = URL.createObjectURL(blob);
            let audio = $(`<div class="audio toast">
                             <div class="audio-title">New Audio</div>
                             <div class="d-flex">
                               <audio controls src="${url}"></audio>
                               <button class="btn btn-sm">×</button>
                             </div>
                           </div>`);
            this.list.append(audio);
        },

        reset: function() {
            this.stream = null;
            this.recorder = null;
            this.startTime = null;
            this.endTime = null;
        }
    };


    let Shadowing = function() {
        this.form = $('#link-form');
        this.link = $('#youtube-link');
        this.result = $('#result');
        this.video = $('#video');
        this.subtitles = $('#subtitles');

        this.audio = new Audio($('#recordings'));
        this.bindEvents();
    };
    Shadowing.prototype = {
        matchHost: 'www.youtube.com',
        paramName: 'v',

        getVideoID: function(input) {
            try {
                let url = new URL(input);
                if (url.host == this.matchHost) {
                    return url.searchParams.get(this.paramName);
                }
            } catch(e) {}

            return null;
        },

        bindEvents: function() {
            this.form.on('submit', e => {
                let id = this.getVideoID(this.link.val());
                if (id) {
                    if (!this.currentVideo || this.currentVideo.id != id) {
                        this.resetVideo();
                        this.loadVideo(id);
                        this.result.show();
                    }
                }

                document.activeElement.blur();
                return false;
            });

            $(document).on('keyup', e => {
                if (!this.currentVideo || !this.currentVideo.loaded) {
                    return;
                }

                if (e.keyCode == 32) {
                    this.currentVideo.togglePause();  // space
                    this.audio.togglePause();
                } else if (e.keyCode == 37) {
                    this.currentVideo.backward();     // arrow left
                } else if (e.keyCode == 39) {
                    this.currentVideo.forward();      // arrow right
                } else if (e.keyCode == 38) {
                    this.currentVideo.faster();       // arrow up
                } else if (e.keyCode == 40) {
                    this.currentVideo.slower();       // arrow down
                } else if (e.keyCode == 13) {
                    this.currentVideo.togglePause();  // enter
                    this.audio.stop();
                }

                return false;
            });

            $(document).on('click', '#recordings .audio button', function(e) {
                $(this).closest('.audio').remove();
            })
        },

        loadVideo: function(videoId) {
            this.currentVideo = new Video(videoId);
            this.currentVideo.loadPlayer(this.video);
            this.currentVideo.loadSubtitles(this.subtitles);            
        },

        resetVideo: function() {
            this.currentVideo = null;
            this.video.html('');
            this.subtitles.html('');
        }
    };

    window.shadowing = new Shadowing();
});
