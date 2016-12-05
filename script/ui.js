/**
 * @class Loader
 * @description Manages loading of all model related files
 */

var ui = {};

ui.refreshVertexCount = function() {
    var pbar = document.getElementById('vertexCountProgressBar');

    document.getElementById('currentVertexCount').innerHTML = drawer.vertexCountCurrent;
    pbar.value = drawer.vertexCountCurrent;

    document.getElementById('vertexCount').innerHTML = drawer.vertexCount;
    pbar.max = drawer.vertexCount;
};

ui.bindSlider = function (levelCount) {
    document.getElementById('levelCount').innerHTML = levelCount;

    var slider = document.getElementById('levelSlider');
    slider.max = levelCount;
    slider.onchange = function () {
        drawer.setLevel(this.value);
    }
};

ui.setSliderLevel = function (level) {
    document.getElementById('levelSlider').value = level;
    document.getElementById('currentLevel').innerHTML = level;
};
