// Get DOM elements
const audioUpload = document.getElementById('audioUpload');
const audio = document.getElementById('audio');
const volumeSlider = document.getElementById('volumeSlider');
const volumeLabel = document.getElementById('volumeLabel');
const downloadButton = document.getElementById('downloadButton');

let audioContext, audioBuffer, audioSourceNode, gainNode, audioBlob;

// Function to handle file upload and process the audio
audioUpload.addEventListener('change', handleFileUpload);

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file && file.type.startsWith('audio/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const audioData = e.target.result;
      initAudioContext(audioData);
    };
    reader.readAsArrayBuffer(file);
  }
}

function initAudioContext(audioData) {
  // Initialize AudioContext
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Decode audio file
  audioContext.decodeAudioData(audioData, (buffer) => {
    audioBuffer = buffer;
    audio.src = URL.createObjectURL(new Blob([audioData]));
    audio.load();
    
    // Enable volume slider and download button
    volumeSlider.disabled = false;
    downloadButton.disabled = false;
    
    // Set up the audio graph for volume control
    setUpAudioGraph();
  });
}

function setUpAudioGraph() {
  // Create an audio source from the buffer
  audioSourceNode = audioContext.createBufferSource();
  audioSourceNode.buffer = audioBuffer;

  // Create a gain node for volume control
  gainNode = audioContext.createGain();
  audioSourceNode.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Connect the source node to the audio context
  audioSourceNode.start(0);
  
  // Set the initial volume based on the slider (100%)
  updateVolume();
}

// Function to update volume based on slider input
volumeSlider.addEventListener('input', updateVolume);

function updateVolume() {
  const volume = volumeSlider.value / 1000; // Normalize volume (0 to 1)
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime); // Set volume
  volumeLabel.textContent = `${volumeSlider.value}%`;
}

// Function to create a download link for the modified audio
downloadButton.addEventListener('click', downloadAudio);

function downloadAudio() {
  // Create a new audio buffer with the modified volume
  const offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioContext.sampleRate);
  const offlineSource = offlineContext.createBufferSource();
  offlineSource.buffer = audioBuffer;
  
  // Connect the offline source to the gain node
  const offlineGainNode = offlineContext.createGain();
  offlineSource.connect(offlineGainNode);
  offlineGainNode.connect(offlineContext.destination);

  // Set the volume on the offline gain node
  offlineGainNode.gain.setValueAtTime(gainNode.gain.value, offlineContext.currentTime);

  // Render the audio
  offlineSource.start();
  offlineContext.startRendering().then((renderedBuffer) => {
    // Convert the rendered buffer to WAV or MP3 for download
    const wavData = bufferToWave(renderedBuffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    // Create a download link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified_audio.wav';
    a.click();
  });
}

// Helper function to convert audio buffer to WAV format
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
