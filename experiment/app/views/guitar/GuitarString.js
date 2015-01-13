var PIXI = require('pixi.js/bin/pixi.dev.js');
var p2 = require('p2');

module.exports = (function() {
  'use strict';

  const SEGMENTS = 3;
  const SOUND_OPTIONS = [
    'stringbass_C2',
    'stringbass_A-sharp',
    'stringbass_G',
    'stringbass_F'
  ];

  return function GuitarString(audioManager, channel, model) {
    var pointA;
    var pointB;

    var displayContainerCenter;
    var points = [];

    var dots = [];

    var state = 'unStrung';  //  'strung'

    var spring1;
    var spring2;
    var lineDistance;
    var capsuleBody;
    var capsuleShape;

    var anchorPoint1;
    var anchorPoint2;

    var mouseColliderBody;
    var mouseColliderGraphic;
    var mouseColliderBodyShape;

    var lineGraphic;
    var lineGraphicShadow;
    var world;
    var baseLayer;

    var isplayingInteractionSound = false;

    var currentMouseX = 0;
    var lastMouseX = 0;

    var currentMouseY = 0;
    var lastMouseY = 0;
    var sound;

    var onActivateCallback_;

    var self = {
      init,
      setInitPoints,
      updatePointsMouse,
      updatePointsResize,
      dragMouseCollisionCheck,
      updatePoints,
      updateSpacing,
      getOtherPointPosition,
      getOtherPointId,
      destroy,
      playNote,
      bumpStringDepths,
      render,
      onActivate,
      updateDotPosition,
      setDots,
      setFirstDot,
      getFirstDot,
      setSecondDot,
      getSecondDot,
      getPID: () => model.pid,
      getModel: () => model
    };

    function init(pid_, displayContainerCenter_, baseLayer_) {
      model.pid = pid_;
      displayContainerCenter = displayContainerCenter_;

      lineGraphic = new PIXI.Graphics();
      lineGraphicShadow = new PIXI.Graphics();

      baseLayer = baseLayer_;
      baseLayer.dragging = true;

      world = new p2.World({
        gravity: [-0.01, -0.01]
      });

      displayContainerCenter.addChild(lineGraphicShadow);
      displayContainerCenter.addChild(lineGraphic);

      displayContainerCenter.interactive = true;
      createMouseCollider();
      createAnchorGraphics();
      createSprings();
      addEventListeners();

      createPoints();
    }

    function addEventListeners() {
      world.on('endContact', onContact);
    }

    function onContact() {
      if (isplayingInteractionSound === false && lastMouseX !== currentMouseX &&  lastMouseY !== currentMouseY && sound !== undefined) {
        isplayingInteractionSound = true;
        audioManager.playSoundImmediately(sound, channel);
        onActivateCallback_(model.pid, sound);
        window.setTimeout(resetisplayingInteractionSound, 400);
      }
    }

    function resetisplayingInteractionSound() {
      isplayingInteractionSound = false;
    }

    function dragMouseCollisionCheck(data) {
      var newPosition = data.getLocalPosition(baseLayer);
      mouseColliderGraphic.position.x = newPosition.x;
      mouseColliderGraphic.position.y = newPosition.y;
      mouseColliderBody.position[0] = newPosition.x;
      mouseColliderBody.position[1] = newPosition.y;
      lastMouseX =  currentMouseX;
      currentMouseX = newPosition.x;
    }

    function removeEventListeners() {
      world.off('endContact', onContact);

      displayContainerCenter.mousedown = displayContainerCenter.touchstart = null;
      displayContainerCenter.mousemove = displayContainerCenter.touchmove = null;
    }

    function createMouseCollider() {
      mouseColliderBodyShape = new p2.Circle(1);
      mouseColliderBody = new p2.Body({
        mass:1,
        position: [80,500],
        velocity: [0, 0],
        force: [0, 0],
        type: 1,
        angularVelocity: 0
      });

      mouseColliderBody.addShape(mouseColliderBodyShape);

      mouseColliderBody.position[0] = -1100;
      world.addBody(mouseColliderBody);

      mouseColliderGraphic = new PIXI.Graphics();
      mouseColliderGraphic.beginFill(0xff0000);
      mouseColliderGraphic.drawCircle(20, 20, 0);
      displayContainerCenter.addChild(mouseColliderGraphic);

      mouseColliderGraphic.position.x = -1100;
    }

    function updateSpacing(units) {
      var internalLen = lineDistance - 29;

      if (internalLen < units * 1) {
        sound = SOUND_OPTIONS[0];
      } else if (internalLen < units * 2) {
        sound = SOUND_OPTIONS[1];
      } else if (internalLen < units * 3) {
        sound = SOUND_OPTIONS[2];
      } else {
        sound = SOUND_OPTIONS[3];
      }
    }

    function createSprings() {
      lineDistance = getlineDistance(anchorPoint1.position, anchorPoint2.position);
      capsuleShape = new p2.Capsule(Math.floor(lineDistance) - 30,20);
      capsuleBody = new p2.Body({
        mass: 1,
        position: [0,0],
        velocity: [1, 1],
        force: [10, 10],
        type: 1,
        angularVelocity: 1
      });

      var plane = new p2.Body({
        position: [0, 0]
      });

      capsuleBody.addShape(capsuleShape);
      world.addBody(capsuleBody);

      spring1 = new p2.LinearSpring(capsuleBody, plane, {
        restLength: 0.5,
        stiffness: 10,
        localAnchorA: [-capsuleShape.length/2,0],
        worldAnchorB: [200,200],
      });

      world.addSpring(spring1);

      spring2 = new p2.LinearSpring(capsuleBody, plane, {
        restLength: 0.5,
        stiffness: 10,
        damping: 1,
        localAnchorA: [capsuleShape.length/2,0],
        worldAnchorB: [0,0],
      });

      world.addSpring(spring2);
    }

    function createAnchorGraphics() {
      anchorPoint1 = new PIXI.Graphics();
      anchorPoint1.beginFill(0x000000);
      anchorPoint1.drawCircle(0, 0,3);
      displayContainerCenter.addChild(anchorPoint1);

      anchorPoint2 = new PIXI.Graphics();
      anchorPoint2.beginFill(0x000000);
      anchorPoint2.drawCircle(0, 0, 3);
      displayContainerCenter.addChild(anchorPoint2);

      anchorPoint2.position.x = 200;
      anchorPoint2.position.y = 200;
    }

    function resizeStrung() {
      lineDistance = getlineDistance(anchorPoint1.position, anchorPoint2.position);
      capsuleBody.removeShape(capsuleShape);
      capsuleShape = new p2.Capsule(Math.floor(lineDistance) - 180,50);
      capsuleBody.addShape(capsuleShape);
    }

   function getlineDistance(point1, point2) {
      var xs = 0;
      var ys = 0;

      xs = point2.x - point1.x;
      xs = xs * xs;

      ys = point2.y - point1.y;
      ys = ys * ys;

      return Math.sqrt(xs + ys);
    }

    function renderLine() {
      lineGraphic.clear();
      lineGraphic.lineStyle(3, 0xffffff, 1);
      lineGraphic.moveTo(anchorPoint1.position.x, anchorPoint1.position.y);
      lineGraphic.quadraticCurveTo(capsuleBody.position[0], capsuleBody.position[1], anchorPoint2.position.x, anchorPoint2.position.y);

      lineGraphicShadow.clear();
      lineGraphicShadow.lineStyle(8, 0x000000, 0.1);
      lineGraphicShadow.moveTo(anchorPoint1.position.x, anchorPoint1.position.y);
      lineGraphicShadow.quadraticCurveTo(capsuleBody.position[0]+10, capsuleBody.position[1]+10, anchorPoint2.position.x, anchorPoint2.position.y);
    }

    function bumpStringDepths() {
      displayContainerCenter.setChildIndex(lineGraphicShadow, displayContainerCenter.children.length-1);
      displayContainerCenter.setChildIndex(lineGraphic, displayContainerCenter.children.length-1);
    }

    function createPoints() {
      for (let i = 0; i <= SEGMENTS; i++) {
        points.push(new PIXI.Point(0, 0));
      }
    }

    function setInitPoints(pointA_, pointB_) {
      pointA = pointA_;
      pointB = pointB_;
      getRun(pointA, pointB, SEGMENTS );
    }

    function updatePointsMouse(pointA_, pointB_) {
      pointA = pointA_;
      pointB = pointB_;
      getRun(pointA, pointB, SEGMENTS );
    }

    function updatePoints(pointA_, pointB_) {
      pointA = pointA_;
      pointB = pointB_;

      getRun(pointA, pointB, SEGMENTS );

      state = 'strung';
      resizeStrung();
    }

    function updateDotPosition() {
      if (dots[0] && dots[1]) {
        updatePoints(dots[0].getPosition(), dots[1].getPosition());
      }
    }

    function setDots(a, b) {
      setFirstDot(a);
      setSecondDot(b);
      updateDotPosition();
    }

    function setFirstDot(a) {
      dots[0] = a;
      model.pointA = a && a.pid;
    }

    function setSecondDot(b) {
      dots[1] = b;
      model.pointB = b && b.pid;
      updateDotPosition();
    }

    function getFirstDot() {
      return dots[0];
    }

    function getSecondDot() {
      return dots[1];
    }

    function updatePointsResize() {
      getRun(pointA, pointB, SEGMENTS );
      resizeStrung();
    }

    function destroy() {
      world.removeBody(mouseColliderBody);
      removeEventListeners();
      displayContainerCenter.removeChild(lineGraphicShadow);
      displayContainerCenter.removeChild(lineGraphic);

      displayContainerCenter.removeChild(anchorPoint2);
      displayContainerCenter.removeChild(anchorPoint1);

      displayContainerCenter.removeChild(mouseColliderGraphic);

      world = null;
    }

    function getOtherPointPosition(item) {
      if (item.position.x === points[0].x && item.position.y === points[0].y) {
        return pointB;
      } else {
        return pointA;
      }
    }

    function getOtherPointId(item, pointObject) {
      var idA = pointObject.pointA;
      var idB = pointObject.pointB;

      if (item.position.x === points[0].x && item.position.y === points[0].y) {
        pointObject.pointA = idB;
      } else {
        pointObject.pointA = idA;
      }
    }

    function getRun(point1, point2, SEGMENTS ) {
      var xs = point2.x - point1.x;
      var ys = point2.y - point1.y;
      var stepx = xs/SEGMENTS;
      var stepy = ys/SEGMENTS;

      for (var i = 0; i < SEGMENTS+1; i++) {
        points[i].x = point1.x+(stepx * i);
        points[i].y =  point1.y+(stepy * i);
      }
    }

    function render(delta) {
      renderBodies(delta);
    }

    function playNote() {
      capsuleBody.position[0] = points[1].x + 80;
      capsuleBody.position[1] = points[1].y + 80;
    }

    function renderBodies(delta) {
      if (!world) { return; }

      anchorPoint1.position.x = points[0].x;
      anchorPoint1.position.y = points[0].y;
      anchorPoint2.position.x = points[SEGMENTS].x;
      anchorPoint2.position.y = points[SEGMENTS].y;

      world.step(1 / 60, delta * 1000);
      renderStringBodies();
    }

    function renderStringBodies() {
      spring2.setWorldAnchorB([anchorPoint1.position.x,anchorPoint1.position.y]);
      spring1.setWorldAnchorB([anchorPoint2.position.x,anchorPoint2.position.y]);

      mouseColliderBody.position[0] = mouseColliderGraphic.position.x;
      mouseColliderBody.position[1] = mouseColliderGraphic.position.y;

      lastMouseX =  currentMouseX;
      currentMouseX = mouseColliderBody.position[0];

      lastMouseY =  currentMouseY;
      currentMouseY = mouseColliderBody.position[1];

      renderLine();
    }

    function onActivate(cb) {
      onActivateCallback_ = cb;
    }

    return self;
  };
})();