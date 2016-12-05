/**
 * @class Loader
 * @description Manages loading of all model related files
 */

var ui = {};

ui.refreshVertexCount = function() {
  document.getElementById('currentVertexCount').innerHTML = drawer.vertexCountCurrent;
  document.getElementById('vertexCount').innerHTML = drawer.vertexCount;
};

ui.createSlider = function (levelCount) {
  document.getElementById('levelSliderContainer').innerHTML = '<input id="levelSlider" type="range" min="1" max="'+levelCount+'" value="1">';
  document.getElementById('levelSlider').onchange = function () {
    drawer.setLevel(this.value);
  }
};

ui.setSliderLevel = function (level) {
  document.getElementById('levelSlider').value = level;
};
