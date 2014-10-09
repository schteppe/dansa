function Actor(imgUrl, fileInfo, props) {
    this.props = {
        x: 0,
        y: 0,
        scaleX: 0,
        scaleY: 0,
        rotation: 0,
        alpha: 1,
        frameIndex: 0
    };
    merge(this.props, props);

    this.sprite = Sprite(imgUrl, fileInfo);
    this.queuedKeyFrames = [];
    this.durationSeconds = undefined;
    this.intoAnimationSeconds = undefined;
    this.beginProps = undefined;
    this.endProps = undefined;
}

Actor.prototype.draw = function () {
    this.sprite.draw(canvas, this.props.frameIndex, this.props.x, this.props.y, this.props.scaleX, this.props.scaleY, this.props.rotation, this.props.alpha);
};

Actor.prototype.update = function (deltaSeconds) {
    if (this.queuedKeyFrames.length > 0) {
        if (undefined === this.durationSeconds) {
            var keyFrame = this.queuedKeyFrames.shift();
            this.durationSeconds = keyFrame.durationSeconds;
            this.intoAnimationSeconds = 0;
            this.beginProps = deepCopy(this.props);
            this.endProps = deepCopy(keyFrame.props);
        }
    }
    if (undefined !== this.durationSeconds) {
        this.intoAnimationSeconds += deltaSeconds;
        var percentThrough = this.intoAnimationSeconds / this.durationSeconds;
        if (percentThrough >= 1) {
            merge(this.props, this.endProps);
            this._endKeyframe();
        } else {
            var attrs = Object.keys(this.endProps);
            for (var i = 0; i < attrs.length; i++) {
                var attr = attrs[i];
                this.props[attr] = this.beginProps[attr] + (this.endProps[attr] - this.beginProps[attr]) * percentThrough;
            }
            /*
            for (var attr in this.endProps) {
                this.props[attr] = this.beginProps[attr] + (this.endProps[attr] - this.beginProps[attr]) * percentThrough;
            }
            */
        }
    }
};

Actor.prototype.set = function (props) {
    merge(this.props, props);
    return this;
};

Actor.prototype.animate = function (props, sec) {
    var keyFrame = {
        props: deepCopy(props),
        durationSeconds: sec,
    };
    this.queuedKeyFrames.push(keyFrame);
    return this;
};

Actor.prototype.stop = function () {
    this._endKeyframe();
    this.queuedKeyFrames = [];
    return this;
};

Actor.prototype.finish = function () {
    this._endKeyframe();
    this.queuedKeyFrames = [];
    return this;
};

Actor.prototype._endKeyframe = function () {
    this.durationSeconds = undefined;
    this.intoAnimationSeconds = undefined;
    this.beginProps = undefined;
    this.endProps = undefined;
};
