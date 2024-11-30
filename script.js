const audio = document.getElementById('audio');
const volumeSlider = document.getElementById('volumeSlider');
const volumeLabel = document.getElementById('volumeLabel');

// Update the volume based on slider value
volumeSlider.addEventListener('input', function () {
  const volume = volumeSlider.value / 1000; // Convert to a value between 0 and 1
  audio.volume = volume;
  
  // Update the volume label percentage
  volumeLabel.textContent = `${volumeSlider.value}%`;
});
