$(function() {
    let formatTime = function(seconds) {
        let date = new Date(0);
        date.setSeconds(seconds);
        if (date.getUTCHours()) {
            return date.toISOString().substr(11, 8);
        } 
        return date.toISOString().substr(14, 5);
    };


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
                        return {
                            text: $(this).text(),
                            start: $(this).attr('start')
                        };
                    }).toArray();

                    textList.forEach(item => {
                        let start = formatTime(parseInt(item.start));
                        let text = this.decode(item.text);
                        let line = `<p class="line" 
                                       data-start-formatted="${start}"
                                       data-start="${item.start}">${text}</p>`;
                        lines.append(line);
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

        togglePause: function(stop, time) {
            if (!this.recorder) {
                this.startTime = formatTime(time);
                return this.start();
            }

            if (this.recorder.recording) {
                this.recorder.stop();
                if (stop) {
                    this.stopTime = formatTime(time);
                    this.stop();
                }
            } else {
                this.recorder.record();
            }
        },

        stop: function() {
            this.stream.getAudioTracks()[0].stop();
            this.recorder.exportWAV(blob => {
                this.export(blob);
                this.reset();
            });
        },

        export: function(blob) {
            let url = URL.createObjectURL(blob);
            let audio = $(`<div class="audio toast">
                             <div class="audio-title">${this.startTime} - ${this.stopTime}</div>
                             <div class="d-flex">
                               <audio controls src="${url}"></audio>
                               <button class="btn btn-sm">&times;</button>
                             </div>
                           </div>`);
            this.list.prepend(audio);
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
        this.init();
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

        init: function() {
            let url = new URL(location.href);
            let id = url.searchParams.get(this.paramName);
            if (id) {
                setTimeout(() => {
                    this.submit(id);   
                }, 1000);
            }
        },

        submit: function(id) {
            if (!this.currentVideo || this.currentVideo.id != id) {
                history.pushState('', `${document.title} - ${id}`, `?${this.paramName}=${id}`);
                this.resetVideo();
                this.loadVideo(id);
                this.result.show();
            }

            document.activeElement.blur();
            this.result.find('.divider-vert').show();
        },

        bindEvents: function() {
            this.form.on('submit', e => {
                let id = this.getVideoID(this.link.val());
                if (id) {
                    this.submit(id);
                }
                return false;
            });

            $(document).on('keyup', e => {
                if (!this.currentVideo || !this.currentVideo.loaded) {
                    return;
                }

                if (e.keyCode == 32 || e.keyCode == 13) { // space
                    let stop = e.keyCode == 13;           // enter
                    let time = this.currentVideo.player.getCurrentTime();
                    this.currentVideo.togglePause();  
                    this.audio.togglePause(stop, time);
                } else if (e.keyCode == 37) {
                    this.currentVideo.backward();         // arrow left
                } else if (e.keyCode == 39) {
                    this.currentVideo.forward();          // arrow right
                } else if (e.keyCode == 38) {
                    this.currentVideo.faster();           // arrow up
                } else if (e.keyCode == 40) {
                    this.currentVideo.slower();           // arrow down
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
