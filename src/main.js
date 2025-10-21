document.addEventListener('DOMContentLoaded', () => {
  Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;

  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    animation: false,
    baseLayerPicker: false,
    geocoder: true,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
  });
  viewer.shadows = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.shadows = Cesium.ShadowMode.RECEIVE_ONLY;

  let editableBuilding = null;
  let isPlacingBuilding = false;

  function initializeUI() {
    document.getElementById('add-building-btn').addEventListener('click', () => {
      isPlacingBuilding = true;
      viewer.container.style.cursor = 'crosshair';
      document.getElementById('building-editor').classList.add('hidden');
      viewer.selectedEntity = null;
      editableBuilding = null;
    });

    const buildingEditorControls = [
      'building-width-slider',
      'building-depth-slider',
      'building-box-height-slider',
      'building-rotation-slider',
      'building-color-picker',
    ];
    buildingEditorControls.forEach((id) =>
      document.getElementById(id).addEventListener('input', updateBuildingFromEditor),
    );

    document.getElementById('building-name-input').addEventListener('input', updateBuildingName);

    document.getElementById('delete-building-btn').addEventListener('click', deleteBuilding);

    document.getElementById('save-scene-btn').addEventListener('click', saveScene);
    document
      .getElementById('load-scene-btn')
      .addEventListener('click', () => document.getElementById('scene-upload-input').click());
    document.getElementById('scene-upload-input').addEventListener('change', loadScene);
  }

  function updateBuildingName() {
    if (!editableBuilding) return;
    const name = document.getElementById('building-name-input').value;
    editableBuilding.name = name || 'Edificio sin nombre';
  }

  function deleteBuilding() {
    if (!editableBuilding) return;
    viewer.entities.remove(editableBuilding);
    editableBuilding = null;
    viewer.selectedEntity = null;
    document.getElementById('building-editor').classList.add('hidden');
    document.getElementById('building-name-input').value = '';
  }

  function saveScene() {
    const sceneData = [];
    for (const entity of viewer.entities.values) {
      if (entity.box) {
        const pos = entity.position.getValue(viewer.clock.currentTime);
        const orient = entity.orientation.getValue(viewer.clock.currentTime);
        const dimensions = entity.box.dimensions.getValue(viewer.clock.currentTime);
        const color = entity.box.material.color
          .getValue(viewer.clock.currentTime)
          .toCssColorString();
        sceneData.push({
          name: entity.name || 'Edificio sin nombre', // **NUEVO: Guardar nombre**
          position: { x: pos.x, y: pos.y, z: pos.z },
          orientation: { x: orient.x, y: orient.y, z: orient.z, w: orient.w },
          dimensions: { x: dimensions.x, y: dimensions.y, z: dimensions.z },
          color: color,
        });
      }
    }
    const json = JSON.stringify(sceneData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'escena_edificios.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function loadScene(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        viewer.entities.removeAll();
        editableBuilding = null;
        const sceneData = JSON.parse(e.target.result);
        sceneData.forEach((data) => {
          editableBuilding = viewer.entities.add({
            name: data.name || 'Edificio sin nombre', // **NUEVO: Cargar nombre**
            position: new Cesium.Cartesian3(data.position.x, data.position.y, data.position.z),
            orientation: new Cesium.Quaternion(
              data.orientation.x,
              data.orientation.y,
              data.orientation.z,
              data.orientation.w,
            ),
            box: {
              dimensions: new Cesium.Cartesian3(
                data.dimensions.x,
                data.dimensions.y,
                data.dimensions.z,
              ),
              material: Cesium.Color.fromCssColorString(data.color).withAlpha(0.8),
              shadows: Cesium.ShadowMode.ENABLED,
            },
          });
        });
      } catch (error) {
        console.error('Error loading scene:', error);
        alert('Error al cargar el archivo de escena.');
      }
    };
    reader.readAsText(file);
  }

  function updateBuildingFromEditor() {
    if (!editableBuilding) return;
    const width = parseFloat(document.getElementById('building-width-slider').value);
    const depth = parseFloat(document.getElementById('building-depth-slider').value);
    const boxHeight = parseFloat(document.getElementById('building-box-height-slider').value);
    const rotation = parseFloat(document.getElementById('building-rotation-slider').value);
    const color = document.getElementById('building-color-picker').value;

    document.getElementById('building-width-value').textContent = width;
    document.getElementById('building-depth-value').textContent = depth;
    document.getElementById('building-box-height-value').textContent = boxHeight;
    document.getElementById('building-rotation-value').textContent = rotation;

    editableBuilding.box.dimensions = new Cesium.Cartesian3(width, depth, boxHeight);
    editableBuilding.box.material = Cesium.Color.fromCssColorString(color).withAlpha(0.8);

    const position = editableBuilding.position.getValue(viewer.clock.currentTime);
    const heading = Cesium.Math.toRadians(rotation);
    const orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position,
      new Cesium.HeadingPitchRoll(heading, 0, 0),
    );
    editableBuilding.orientation = orientation;
  }

  function syncEditorWithBuilding() {
    if (!editableBuilding) return;
    const dimensions = editableBuilding.box.dimensions.getValue(viewer.clock.currentTime);
    document.getElementById('building-width-slider').value = dimensions.x;
    document.getElementById('building-depth-slider').value = dimensions.y;
    document.getElementById('building-box-height-slider').value = dimensions.z;

    const color = editableBuilding.box.material.color.getValue(viewer.clock.currentTime);
    document.getElementById('building-color-picker').value = color.toCssHexString();

    let rotation = 0;
    const orientation = editableBuilding.orientation.getValue(viewer.clock.currentTime);
    if (orientation) {
      const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);
      rotation = Cesium.Math.toDegrees(hpr.heading);
    }
    document.getElementById('building-rotation-slider').value = rotation;

    document.getElementById('building-name-input').value = editableBuilding.name || '';

    updateBuildingFromEditor();
  }

  function setupPickingAndDragging() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    let isDragging = false;
    let draggedEntity = null;
    let initialPosition = null;
    let initialMousePosition = null;

    handler.setInputAction(function (movement) {
      if (isPlacingBuilding) {
        const position = viewer.scene.pickPosition(movement.position);
        if (Cesium.defined(position)) {
          const boxHeight = parseFloat(document.getElementById('building-box-height-slider').value);
          const cartographic = Cesium.Cartographic.fromCartesian(position);
          const centerPosition = Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            cartographic.height + boxHeight / 2,
          );
          const orientation = Cesium.Transforms.headingPitchRollQuaternion(
            centerPosition,
            new Cesium.HeadingPitchRoll(0, 0, 0),
          );

          editableBuilding = viewer.entities.add({
            name: 'New Building',
            position: centerPosition,
            orientation: orientation,
            box: {
              dimensions: new Cesium.Cartesian3(50, 50, boxHeight),
              material: Cesium.Color.WHITE.withAlpha(0.8),
              shadows: Cesium.ShadowMode.ENABLED,
            },
          });

          isPlacingBuilding = false;
          viewer.container.style.cursor = 'default';
          viewer.selectedEntity = editableBuilding;
          syncEditorWithBuilding();
          document.getElementById('building-editor').classList.remove('hidden');
        }
      } else {
        const pickedObject = viewer.scene.pick(movement.position);
        if (
          Cesium.defined(pickedObject) &&
          Cesium.defined(pickedObject.id) &&
          Cesium.defined(pickedObject.id.box)
        ) {
          editableBuilding = pickedObject.id;
          viewer.selectedEntity = editableBuilding;
          syncEditorWithBuilding();
          document.getElementById('building-editor').classList.remove('hidden');
        } else if (!isDragging) {
          viewer.selectedEntity = null;
          editableBuilding = null;
          document.getElementById('building-editor').classList.add('hidden');
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(function (click) {
      const pickedObject = viewer.scene.pick(click.position);
      if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id) && pickedObject.id.box) {
        isDragging = true;
        draggedEntity = pickedObject.id;
        viewer.scene.screenSpaceCameraController.enableInputs = false;
        initialPosition = draggedEntity.position.getValue(viewer.clock.currentTime);
        initialMousePosition = Cesium.clone(click.position);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction(function (movement) {
      if (isDragging && draggedEntity) {
        if (movement.shift) {
          const dy = initialMousePosition.y - movement.endPosition.y;
          const sensitivity = 1.0;
          const heightChange = dy * sensitivity;
          const up = Cesium.Cartesian3.normalize(initialPosition, new Cesium.Cartesian3());
          const newPosition = Cesium.Cartesian3.add(
            initialPosition,
            Cesium.Cartesian3.multiplyByScalar(up, heightChange, new Cesium.Cartesian3()),
            new Cesium.Cartesian3(),
          );
          draggedEntity.position = newPosition;
        } else {
          draggedEntity.show = false;
          const newPositionOnTerrain = viewer.scene.pickPosition(movement.endPosition);
          draggedEntity.show = true;
          if (Cesium.defined(newPositionOnTerrain)) {
            const boxHeight = draggedEntity.box.dimensions.getValue(viewer.clock.currentTime).z;
            const cartographic = Cesium.Cartographic.fromCartesian(newPositionOnTerrain);
            draggedEntity.position = Cesium.Cartesian3.fromRadians(
              cartographic.longitude,
              cartographic.latitude,
              cartographic.height + boxHeight / 2,
            );
            initialPosition = draggedEntity.position.getValue(viewer.clock.currentTime);
            initialMousePosition = Cesium.clone(movement.endPosition);
          }
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(function () {
      if (isDragging) {
        isDragging = false;
        draggedEntity = null;
        viewer.scene.screenSpaceCameraController.enableInputs = true;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_UP);
  }

  function setupCoordinateTracking() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    const coordsDisplay = document.getElementById('coords-display');

    handler.setInputAction(function (movement) {
      // Intentar obtener la posición del terreno
      const cartesian = viewer.camera.pickEllipsoid(
        movement.endPosition,
        viewer.scene.globe.ellipsoid,
      );

      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude).toFixed(6);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude).toFixed(6);
        const height = cartographic.height.toFixed(2);

        coordsDisplay.textContent = `Mouse: Lon ${longitude}°, Lat ${latitude}°, Alt ${height}m`;
      } else {
        coordsDisplay.textContent = 'Mouse: Fuera del globo';
      }

      const cameraPosition = viewer.camera.positionCartographic;
      const camLon = Cesium.Math.toDegrees(cameraPosition.longitude).toFixed(6);
      const camLat = Cesium.Math.toDegrees(cameraPosition.latitude).toFixed(6);
      const camHeight = cameraPosition.height.toFixed(2);

      coordsDisplay.textContent += ` | Cámara: Lon ${camLon}°, Lat ${camLat}°, Alt ${camHeight}m`;
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  function setupTimeControls() {
    const timeSlider = document.getElementById('time-slider');
    const timeDisplay = document.getElementById('time-display');
    const animateTimeBtn = document.getElementById('animate-time-btn');
    const today = new Date();
    const start = Cesium.JulianDate.fromDate(
      new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0),
    );
    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = Cesium.JulianDate.addDays(start, 1, new Cesium.JulianDate());
    viewer.clock.currentTime = Cesium.JulianDate.addHours(start, 12, new Cesium.JulianDate());
    viewer.clock.multiplier = 4000;
    viewer.clock.shouldAnimate = false;
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    animateTimeBtn.addEventListener('click', () => {
      viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate;
    });
    timeSlider.addEventListener('input', (e) => {
      viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
        start,
        parseInt(e.target.value, 10),
        new Cesium.JulianDate(),
      );
    });
    viewer.clock.onTick.addEventListener((clock) => {
      let secondsIntoDay = Cesium.JulianDate.secondsDifference(clock.currentTime, start);
      if (secondsIntoDay < 0) {
        secondsIntoDay += 86400;
      }
      timeSlider.value = secondsIntoDay;
      const hours = Math.floor(secondsIntoDay / 3600) % 24;
      const minutes = Math.floor((secondsIntoDay % 3600) / 60);
      timeDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
        2,
        '0',
      )}`;
    });
  }

  async function setupScene() {
    try {
      const osmBuildings = await Cesium.createOsmBuildingsAsync();
      osmBuildings.shadows = Cesium.ShadowMode.ENABLED;
      viewer.scene.primitives.add(osmBuildings);

      initializeUI();
      setupPickingAndDragging();
      setupTimeControls();
      setupCoordinateTracking();

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-74.0445, 40.68, 2500),
        orientation: { heading: Cesium.Math.toRadians(0.0), pitch: Cesium.Math.toRadians(-35.0) },
      });
    } catch (error) {
      console.error('Error al configurar la escena inicial:', error);
      alert('No se pudo cargar la escena inicial.');
    }
  }

  setupScene();
});
