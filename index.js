class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  
  add(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  
  sub(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  
  mul(scalar) {
    return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
  }
  mulVec(v) {
    return new Vec3(this.x * v.x, this.y * v.y, this.z * v.z);
  }
  
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  
  length() {
    return Math.sqrt(this.dot(this));
  }
  
  normalize() {
    const len = this.length();
    return len > 0 ? this.mul(1 / len) : new Vec3();
  }
  
  clamp(min = 0.0, max = 1.0) {
    return new Vec3(
      Math.max(min, Math.min(max, this.x)),
      Math.max(min, Math.min(max, this.y)),
      Math.max(min, Math.min(max, this.z))
    );
  }
}

class Ray {
  constructor(origin, direction) {
    this.origin = origin;
    this.direction = direction.normalize();
  }
  
  pointAt(t) {
    return this.origin.add(this.direction.mul(t));
  }
}

class Sphere {
  constructor(center, radius, color, isReflective = false) {
    this.center = center;
    this.radius = radius;
    this.color = color;
    this.isReflective = isReflective;
  }
  
  intersect(ray) {
    const oc = ray.origin.sub(this.center);
    const a = ray.direction.dot(ray.direction);
    const b = 2 * oc.dot(ray.direction);
    const c = oc.dot(oc) - this.radius * this.radius;
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0) {
      return -1;
    }
    
    let t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t > 0 ? t : (-b + Math.sqrt(discriminant)) / (2 * a);
  }
  
  getNormal(point) {
    return point.sub(this.center).normalize();
  }
}

class Scene {
  constructor() {
    this.spheres = [];
    this.lights = [];
  }
  
  addSphere(sphere) {
    this.spheres.push(sphere);
  }
  
  addLight(position, intensity, color) {
    this.lights.push({
      position: position,
      intensity: intensity,
      color: color || new Vec3(1, 1, 1)
    });
  }
  
  trace(ray, depth = 0) {
    let closestT = Infinity;
    let closestSphere = null;
    
    for (const sphere of this.spheres) {
      const t = sphere.intersect(ray);
      if (t > 0 && t < closestT) {
        closestT = t;
        closestSphere = sphere;
      }
    }
    
    if (closestSphere === null) {
      return new Vec3(0.2, 0.2, 0.2);
    }
    
    const hitPoint = ray.pointAt(closestT);
    const normal = closestSphere.getNormal(hitPoint);
    let color = this.calculateLighting(hitPoint, normal, closestSphere);
    
    if (depth < 3 && closestSphere.isReflective) {
      const reflectDir = ray.direction.sub(normal.mul(2 * ray.direction.dot(normal)));
      const reflectRay = new Ray(hitPoint.add(normal.mul(0.001)), reflectDir);
      const reflectColor = this.trace(reflectRay, depth + 1);
      color = color.add(reflectColor.mul(0.5));
    }
    
    return color.clamp(0.0, 1.0);
  }
  
  calculateLighting(point, normal, sphere) {
    let color = sphere.color.mul(0.1);
    
    for (const light of this.lights) {
      const lightDir = light.position.sub(point).normalize();
      const shadowRay = new Ray(point.add(normal.mul(0.001)), lightDir);
      let inShadow = false;
      
      for (const s of this.spheres) {
        if (s.intersect(shadowRay) > 0) {
          inShadow = true;
          break;
        }
      }
      
      if (!inShadow) {
        const intensity = Math.max(0, normal.dot(lightDir)) * light.intensity;
        const lightColor = sphere.color.mulVec(light.color);
        color = color.add(lightColor.mul(intensity));
      }
    }
    
    return color.clamp(0.0, 1.0);
  }
}

function renderImage(width, height, scene, canvas, statusElem) {
  const aspectRatio = width / height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  
  const camera = new Vec3(0, 0, -5);
  const viewportHeight = 2.0;
  const viewportWidth = aspectRatio * viewportHeight;
  const focalLength = 1.0;
  
  const totalPixels = width * height;
  let pixelsDone = 0;
  let lastPercent = 0;
  
  return new Promise((resolve) => {
    function processRows(startY, endY) {
      for (let y = startY; y < endY; y++) {
        for (let x = 0; x < width; x++) {
          const u = (x + 0.5) / width;
          const v = (y + 0.5) / height;
          
          const direction = new Vec3(
            viewportWidth * (u - 0.5),
            viewportHeight * (0.5 - v),
            focalLength
          );
          
          const ray = new Ray(camera, direction);
          const color = scene.trace(ray);
          
          const r = Math.min(255, Math.max(0, Math.floor(color.x * 255)));
          const g = Math.min(255, Math.max(0, Math.floor(color.y * 255)));
          const b = Math.min(255, Math.max(0, Math.floor(color.z * 255)));
          
          const idx = (y * width + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
          
          pixelsDone++;
        }
      }
      
      const percent = Math.floor((pixelsDone / totalPixels) * 100);
      if (percent > lastPercent) {
        statusElem.textContent = `Rendering: ${percent}% complete...`;
        lastPercent = percent;
        
        if (percent % 10 === 0) {
          ctx.putImageData(imageData, 0, 0);
        }
      }
      
      if (pixelsDone < totalPixels) {
        const nextStartY = endY;
        const nextEndY = Math.min(height, nextStartY + 10);
        setTimeout(() => processRows(nextStartY, nextEndY), 0);
      } else {
        ctx.putImageData(imageData, 0, 0);
        statusElem.textContent = "Render complete!";
        resolve();
      }
    }
    
    processRows(0, Math.min(height, 10));
  });
}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new Vec3(r, g, b);
}

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const statusElem = document.getElementById('status');
  const renderBtn = document.getElementById('render');
  const resolutionSelect = document.getElementById('resolution');
  const sphereColorSelect = document.getElementById('sphereColor');
  const reflectiveCheck = document.getElementById('reflective');
  const light1X = document.getElementById('light1X');
  const light1Y = document.getElementById('light1Y');
  const light1Z = document.getElementById('light1Z');
  const light1Intensity = document.getElementById('light1Intensity');
  const light1Color = document.getElementById('light1Color');
  
  const light2X = document.getElementById('light2X');
  const light2Y = document.getElementById('light2Y');
  const light2Z = document.getElementById('light2Z');
  const light2Intensity = document.getElementById('light2Intensity');
  const light2Color = document.getElementById('light2Color');
  function updateValueDisplay(slider, valueSpan) {
    document.getElementById(valueSpan).textContent = slider.value;
  }
  light1X.addEventListener('input', () => updateValueDisplay(light1X, 'light1XValue'));
  light1Y.addEventListener('input', () => updateValueDisplay(light1Y, 'light1YValue'));
  light1Z.addEventListener('input', () => updateValueDisplay(light1Z, 'light1ZValue'));
  light1Intensity.addEventListener('input', () => updateValueDisplay(light1Intensity, 'light1IntensityValue'));
  light2X.addEventListener('input', () => updateValueDisplay(light2X, 'light2XValue'));
  light2Y.addEventListener('input', () => updateValueDisplay(light2Y, 'light2YValue'));
  light2Z.addEventListener('input', () => updateValueDisplay(light2Z, 'light2ZValue'));
  light2Intensity.addEventListener('input', () => updateValueDisplay(light2Intensity, 'light2IntensityValue'));
  
  const colorMap = {
    red: new Vec3(1.0, 0.0, 0.0),
    green: new Vec3(0.0, 1.0, 0.0),
    blue: new Vec3(0.0, 0.0, 1.0),
    yellow: new Vec3(1.0, 1.0, 0.0),
    purple: new Vec3(0.8, 0.0, 0.8)
  };
  
  renderBtn.addEventListener('click', async () => {
    renderBtn.disabled = true;
    resolutionSelect.disabled = true;
    sphereColorSelect.disabled = true;
    reflectiveCheck.disabled = true;
    light1X.disabled = true;
    light1Y.disabled = true;
    light1Z.disabled = true;
    light1Intensity.disabled = true;
    light1Color.disabled = true;
    light2X.disabled = true;
    light2Y.disabled = true;
    light2Z.disabled = true;
    light2Intensity.disabled = true;
    light2Color.disabled = true;
    
    const width = parseInt(resolutionSelect.value);
    const height = Math.floor(width * (3/4));
    
    canvas.width = width;
    canvas.height = height;
    
    const scene = new Scene();
    const mainColor = colorMap[sphereColorSelect.value];
    const isReflective = reflectiveCheck.checked;
    
    scene.addSphere(new Sphere(new Vec3(0, 0, 5), 1, mainColor, isReflective));
    scene.addSphere(new Sphere(new Vec3(2, 0, 7), 1, new Vec3(0.0, 1.0, 0.0)));
    scene.addSphere(new Sphere(new Vec3(-2, 0, 7), 1, new Vec3(1.0, 0.0, 0.0)));
    scene.addSphere(new Sphere(new Vec3(0, -101, 5), 100, new Vec3(0.5, 0.5, 0.5)));
    scene.addSphere(new Sphere(new Vec3(0, 3, 8), 1, new Vec3(0.8, 0.8, 0.8), true));
    
    const light1Pos = new Vec3(
      parseFloat(light1X.value),
      parseFloat(light1Y.value),
      parseFloat(light1Z.value)
    );
    const light1Int = parseFloat(light1Intensity.value);
    const light1Col = hexToRgb(light1Color.value);
    scene.addLight(light1Pos, light1Int, light1Col);
    
    const light2Pos = new Vec3(
      parseFloat(light2X.value),
      parseFloat(light2Y.value),
      parseFloat(light2Z.value)
    );
    const light2Int = parseFloat(light2Intensity.value);
    const light2Col = hexToRgb(light2Color.value);
    scene.addLight(light2Pos, light2Int, light2Col);
    
    statusElem.textContent = "Starting render...";
    
    const startTime = performance.now();
    
    await renderImage(width, height, scene, canvas, statusElem);
    
    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000;
    statusElem.textContent = `Render complete! Processing time: ${executionTime.toFixed(2)} seconds`;
    
    renderBtn.disabled = false;
    resolutionSelect.disabled = false;
    sphereColorSelect.disabled = false;
    reflectiveCheck.disabled = false;
    light1X.disabled = false;
    light1Y.disabled = false;
    light1Z.disabled = false;
    light1Intensity.disabled = false;
    light1Color.disabled = false;
    light2X.disabled = false;
    light2Y.disabled = false;
    light2Z.disabled = false;
    light2Intensity.disabled = false;
    light2Color.disabled = false;
  });
});
