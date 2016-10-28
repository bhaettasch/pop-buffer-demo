/**
 * @class Loader
 * @description Manages loading of all model related files
 */

var ui = {};

ui.refreshVertexCount = function() {
  document.getElementById('currentVertexCount').innerHTML = drawer.vertexCountCurrent;
  document.getElementById('vertexCount').innerHTML = drawer.vertexCount;
};