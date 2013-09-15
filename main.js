(function (doc, nav) {
  "use strict";

  var video, width, height, context, pathContext;
  var bufidx = 0, buffers = [];
  var points = []
  var pointHistoryLength = 30

  var $R = new DollarRecognizer();

  function initialize() {
    // The source video.
    video = doc.getElementById("v");
    width = video.width;
    height = video.height;

    // The target canvas.
    var canvas = doc.getElementById("c");
    context = canvas.getContext("2d");

    var pathCanvas = doc.getElementById("path");
    pathContext = pathCanvas.getContext("2d");

    // Prepare buffers to store lightness data.
    for (var i = 0; i < 2; i++) {
      buffers.push(new Uint8Array(width * height));
    }

    // Get the webcam's stream.
    nav.getUserMedia({video: true}, startStream, function () {});
  }

  function startStream(stream) {
    video.src = URL.createObjectURL(stream);
    video.play();

    // Ready! Let's start drawing.
    requestAnimationFrame(draw);
  }

  function draw() {
    var frame = readFrame();

    if (frame) {
        markLightnessChanges(frame.data);
        context.putImageData(frame, 0, 0);
        /* analyze frame */
        var sx = width/4
        var sy = height/4
        var x1=0, y1=0, x2=width, y2=height;
        if(points.length) {
            var lastPoint = points[points.length-1]
            x1 = lastPoint.X - sx/2
            x2 = lastPoint.X + sx/2
            y1 = lastPoint.Y - sy/2
            y2 = lastPoint.Y + sy/2
        }
        var point = analyzeFrame(frame.data, x1, y1, x2, y2)
        if(point) {
            points.push(point)
            var startPoint = (Math.PI/180)*0;
            var endPoint = (Math.PI/180)*360;
            context.beginPath();
            context.arc(point.X,point.Y,10,startPoint,endPoint,true);
            context.fill();
            context.closePath();        

        } 
        /* redraw path */
        pathContext.clearRect ( 0 , 0 , pathContext.width , pathContext.height );
        pathContext.beginPath();
        pathContext.rect(0, 0, width, height);
        pathContext.fillStyle = 'yellow';
        pathContext.fill();
        for(var i=points.length-2; i>0; i--) {
            pathContext.beginPath();
            pathContext.moveTo(points[i-1].X, points[i-1].Y);
            pathContext.lineTo(points[i].X, points[i].Y);
            var c = 255-Math.floor(255*i/points.length)
            pathContext.strokeStyle = 'rgb('+c+','+c+','+c+')'
            pathContext.stroke();
        }

        if(points.length > pointHistoryLength) points.shift()
        if(points.length>10) {
            var pointsCopy = []
            var i=0
            while(i<points.length) {
                pointsCopy.push(new Point(points[i].Y, points[i].Y)); 
                i++
            }
            var result = $R.Recognize(pointsCopy, false);
            console.log(points.length+" "+result.Name+" "+result.Score)
        }
    }

    // Wait for the next frame.
    requestAnimationFrame(draw);
  }


    function analyzeFrame(data, x1, y1, x2, y2) {
        var threshold = 128
        var pixThreshold = (data.length/4)/160
        var x=0,y=0,sumx=0,sumy=0,sumn=0
        for(var j=0; j<data.length; j+=4) {
            if(x>=x1 && x<x2 && y>=y1 && y<y2 && data[j+3] > threshold) {
                sumx+=x
                sumy+=y
                sumn++
            }
            x++;
            if(x==width) {
                x=0
                y++
            }
        }
        if(sumn < pixThreshold) return null
        x = sumx/sumn
        y = sumy/sumn
        return new Point(x,y)
    }

  function readFrame() {
    try {
      context.drawImage(video, 0, 0, width, height);
    } catch (e) {
      // The video may not be ready, yet.
      return null;
    }

    return context.getImageData(0, 0, width, height);
  }

  function markLightnessChanges(data) {
    // Pick the next buffer (round-robin).
    var buffer = buffers[bufidx++ % buffers.length];

    for (var i = 0, j = 0; i < buffer.length; i++, j += 4) {
      // Determine lightness value.
      var current = lightnessValue(data[j], data[j + 1], data[j + 2]);

      // set color
      data[j] = 128
      data[j + 1] = 160
      data[j + 2] = 130

      // Full opacity for changes.
      data[j + 3] = 255 * lightnessHasChanged(i, current);

      // Store current lightness value.
      buffer[i] = current;
    }
  }

  function lightnessHasChanged(index, value) {
    return buffers.some(function (buffer) {
      return Math.abs(value - buffer[index]) >= 15;
    });
  }

  function lightnessValue(r, g, b) {
    return (Math.min(r, g, b) + Math.max(r, g, b)) / 255 * 50;
  }

  addEventListener("DOMContentLoaded", initialize);
})(document, navigator);
