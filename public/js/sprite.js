(function() {
  function LoaderProxy() {
    return {
      draw: function(){},
      fill: function(){},
      frame: function(){},
      update: function(){},
      width: null,
      height: null
    };
  }

  function Sprite(image, options) {
    if (!options)
        options = {};
    var sourceX = options.sourceX || 0;
    var sourceY = options.sourceY || 0;
    var width = options.width || image.width;
    var height = options.height || image.height;
    var frameWidth = options.frameWidth || width;
    var frameHeight = options.frameHeight || height;
    var numFrames = options.numFrames || 1;

    return {
      draw: function(canvas, frameIndex, x, y, scaleX, scaleY, rotationDegrees, alpha) {
        canvas.save();
        canvas.translate( Math.round(x), Math.round(y) );
        if (rotationDegrees != 0)
            canvas.rotate(rotationDegrees * 3.14159265358 / 180);
        if (scaleX != 0 | scaleY != 0)
            canvas.scale(scaleX, scaleY);
        canvas.globalAlpha = alpha;
        canvas.drawImage(
          image,
          sourceX + frameIndex * frameWidth,
          sourceY,
          frameWidth,
          frameHeight,
          -frameWidth/2,
          -frameHeight/2,
          frameWidth,
          frameHeight
        );
        canvas.restore();
      },

      fill: function(canvas, x, y, width, height, repeat) {
        repeat = repeat || "repeat";
        var pattern = canvas.createPattern(image, repeat);
        canvas.fillColor(pattern);
        canvas.fillRect(x, y, width, height);
      },

      width: width,
      height: height,
    };
  }

  Sprite.load = function (url, options) {
    var img = new Image();
    var proxy = LoaderProxy();

    img.onload = function() {
      var sprite = Sprite(this, options);

      $.extend(proxy, sprite);

      if (options && options.loadedCallback) {
          options.loadedCallback(proxy);
      }
    };

    img.src = url;

    return proxy;
  };

  window.Sprite = function(url, options) {
      return Sprite.load(url, options);
  };
  DANSA.Sprite = window.Sprite;
  window.Sprite.EMPTY = LoaderProxy();
  window.Sprite.load = Sprite.load;
}());
