// Get DOM elements
const audioUpload = document.getElementById('audioUpload');
const audio = document.getElementById('audio');
const volumeSlider = document.getElementById('volumeSlider');
const volumeLabel = document.getElementById('volumeLabel');
const downloadButton = document.getElementById('downloadButton');

let audioContext, audioBuffer, audioSourceNode, gainNode, audioBlob;
let fileType = ""; // To track the file type (MP3 or WAV)

audioUpload.addEventListener('change', handleFileUpload);

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file && file.type.startsWith('audio/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const audioData = e.target.result;
      fileType = file.type; // Detect the file type (MP3 or WAV)
      if (fileType === "audio/mp3") {
        processMp3(audioData);
      } else {
        initAudioContext(audioData);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

// If the uploaded file is MP3
function processMp3(audioData) {
  const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
  const audioURL = URL.createObjectURL(audioBlob);
  audio.src = audioURL;
  audio.load();

  volumeSlider.disabled = false;
  downloadButton.disabled = false;
}

// Initialize AudioContext for WAV files or other formats
function initAudioContext(audioData) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  audioContext.decodeAudioData(audioData, (buffer) => {
    audioBuffer = buffer;
    audio.src = URL.createObjectURL(new Blob([audioData]));
    audio.load();

    volumeSlider.disabled = false;
    downloadButton.disabled = false;

    setUpAudioGraph();
  });
}

function setUpAudioGraph() {
  audioSourceNode = audioContext.createBufferSource();
  audioSourceNode.buffer = audioBuffer;
  gainNode = audioContext.createGain();
  audioSourceNode.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  audioSourceNode.start(0);
  updateVolume();
}

volumeSlider.addEventListener('input', updateVolume);

function updateVolume() {
  const volume = volumeSlider.value / 1000;
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
  volumeLabel.textContent = `${volumeSlider.value}%`;
}

downloadButton.addEventListener('click', downloadAudio);

function downloadAudio() {
  if (fileType === 'audio/mp3') {
    downloadMp3(audioUpload.files[0]);
  } else {
    downloadWav();
  }
}

function downloadMp3(file) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(file); // Generate a URL for the audio file
  a.href = url;
  a.download = file.name;
  a.click();
}

function downloadWav() {
  const offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioContext.sampleRate);
  const offlineSource = offlineContext.createBufferSource();
  offlineSource.buffer = audioBuffer;
  const offlineGainNode = offlineContext.createGain();
  offlineSource.connect(offlineGainNode);
  offlineGainNode.connect(offlineContext.destination);
  offlineGainNode.gain.setValueAtTime(gainNode.gain.value, offlineContext.currentTime);
  
  offlineSource.start();
  offlineContext.startRendering().then((renderedBuffer) => {
    const wavData = bufferToWave(renderedBuffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified_audio.wav';
    a.click();
  });
}

function bufferToWave(buffer) {
  const numOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numOfChannels * 2 + 44;
  const view = new DataView(new ArrayBuffer(length));
  let offset = 0;
  const writeString = (str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset++, str.charCodeAt(i));
    }
  };

  writeString('RIFF');
  view.setUint32(offset, length - 8, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numOfChannels, true);
  offset += 2;
  view.setUint32(offset, buffer.sampleRate, true);
  offset += 4;
  view.setUint32(offset, buffer.sampleRate * numOfChannels * 2, true);
  offset += 4;
  view.setUint16(offset, numOfChannels * 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, buffer.length * numOfChannels * 2, true);
  offset += 4;

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    for (let j = 0; j < buffer.length; j++) {
      const sample = Math.max(-1, Math.min(1, channelData[j]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return view.buffer;
}
