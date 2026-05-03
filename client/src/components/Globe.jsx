import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

// ─── Constants ────────────────────────────────────────────────────────────────
const EARTH_RADIUS = 5
const MIN_KM = 300
const MAX_KM = 42000
const MIN_ORBIT_R = 5.4   // just above Earth surface in scene units
const MAX_ORBIT_R = 12    // furthest satellite ring in scene units

// Observer location — update to use real user geolocation (see bottom of file)
const OBSERVER_LAT = 28.5   // example: Orlando, FL
const OBSERVER_LNG = -81.4
const OBSERVER_ALT = 0      // km above sea level

// How many above-horizon satellites to fetch per category
// N2YO /above endpoint returns everything overhead right now
const SEARCH_RADIUS = 90    // degrees — 90 = full hemisphere

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scaledRadius(distanceKm) {
  const t = Math.min(Math.max((distanceKm - MIN_KM) / (MAX_KM - MIN_KM), 0), 1)
  return MIN_ORBIT_R + t * (MAX_ORBIT_R - MIN_ORBIT_R)
}

function latLngToVec3(lat, lng, radius) {
  const phi   = (90 - lat)  * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  )
}

function vec3ToScreen(vec, camera, width, height) {
  const ndc = vec.clone().project(camera)
  return {
    x: (ndc.x * 0.5 + 0.5) * width,
    y: (-ndc.y * 0.5 + 0.5) * height,
  }
}

// ─── Satellite mesh (body + two solar panels) ─────────────────────────────────
function makeSatelliteMesh(color = 0x00e5ff) {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.05, 0.05),
    new THREE.MeshToonMaterial({ color })
  )
  group.add(body)

  const panelMat = new THREE.MeshToonMaterial({ color: 0x1a73e8, side: THREE.DoubleSide })
  const panelGeo = new THREE.BoxGeometry(0.12, 0.002, 0.06)

  const left = new THREE.Mesh(panelGeo, panelMat)
  left.position.set(-0.1, 0, 0)
  group.add(left)

  const right = new THREE.Mesh(panelGeo, panelMat)
  right.position.set(0.1, 0, 0)
  group.add(right)

  return group
}

// ─── Dashed line from Earth surface → satellite ───────────────────────────────
function makeDashedLine(from, to) {
  const points = [from, to]
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineDashedMaterial({
    color: 0x334466,
    dashSize: 0.12,
    gapSize: 0.08,
    linewidth: 1,
  })
  const line = new THREE.Line(geo, mat)
  line.computeLineDistances()
  return line
}

// ─── N2YO fetch ───────────────────────────────────────────────────────────────
// Returns satellites currently above the observer.
// categoryId 0 = all categories. Change to filter (e.g. 18 = CubeSats).
async function fetchSatellites(lat, lng, alt) {
  const url = `http://localhost:3000/api/assets?lat=${lat}&lng=${lng}&alt=${alt}&radius=${SEARCH_RADIUS}&category=0`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Backend error ${res.status}`);
  }

  const data = await res.json();

  return (data.above || []).map((s) => ({
    name: s.satname,
    noradId: s.satid,
    intlDesig: s.intDesignator,
    launchDate: s.launchDate,
    lat: s.satlat,
    lng: s.satlng,
    distance: s.satalt,
  }));
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Globe() {
  const mountRef       = useRef(null)
  const sceneRef       = useRef(null)    // { scene, camera, renderer, controls, raycaster, satMeshes }
  const animFrameRef   = useRef(null)

  const [satellites, setSatellites]     = useState([])
  const [selected, setSelected]         = useState(null)   // { satellite, screenX, screenY }
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)

  // ── Load satellites ──────────────────────────────────────────────────────
  useEffect(() => {
    // Optional: replace hardcoded coords with real geolocation
    // navigator.geolocation.getCurrentPosition(pos => {
    //   fetchSatellites(pos.coords.latitude, pos.coords.longitude, 0).then(...)
    // })

    fetchSatellites(OBSERVER_LAT, OBSERVER_LNG, OBSERVER_ALT)
      .then(sats => {
        setSatellites(sats)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // ── Build Three.js scene once container mounts ────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const W = el.clientWidth
    const H = el.clientHeight

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(window.devicePixelRatio)
    el.appendChild(renderer.domElement)

    // Scene
    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000)
    camera.position.set(0, 0, 20)

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xffffff, 1.2)
    sun.position.set(10, 8, 10)
    scene.add(sun)

    // ── Earth ──────────────────────────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64)

    // Try to load a texture — falls back to solid toon color if no texture provided
    // Drop an earth texture PNG at /public/earth.jpg for best results
    // Free option: https://visibleearth.nasa.gov/images/57730
    const textureLoader = new THREE.TextureLoader()
    let earthMat

    try {
      const tex = textureLoader.load('/earth.jpg')
      earthMat = new THREE.MeshPhongMaterial({ map: tex })
    } catch {
      earthMat = new THREE.MeshToonMaterial({ color: 0x1a4a7a })
    }

    const earth = new THREE.Mesh(earthGeo, earthMat)
    scene.add(earth)

    // Atmosphere glow ring (backside sphere slightly larger)
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.04, 64, 64)
    const atmosMat = new THREE.MeshPhongMaterial({
      color: 0x3399ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    })
    scene.add(new THREE.Mesh(atmosGeo, atmosMat))

    // ── Stars ──────────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry()
    const starPositions = []
    for (let i = 0; i < 2000; i++) {
      starPositions.push(
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400,
        (Math.random() - 0.5) * 400,
      )
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true })
    scene.add(new THREE.Points(starGeo, starMat))

    // ── OrbitControls ──────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.07
    controls.minDistance = 8
    controls.maxDistance = 30
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.4

    // ── Raycaster for click ────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    // Store satellite meshes so we can hit-test them
    const satMeshes = []

    sceneRef.current = { scene, camera, renderer, controls, raycaster, mouse, satMeshes, earth }

    // ── Animate ────────────────────────────────────────────────────────────
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      earth.rotation.y += 0.0005   // slow Earth spin
      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ────────────────────────────────────────────────────────────
    function onResize() {
      const w = el.clientWidth
      const h = el.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(animFrameRef.current)
      renderer.dispose()
      el.removeChild(renderer.domElement)
    }
  }, [])

  // ── Rebuild satellites in scene when data arrives ─────────────────────────
  useEffect(() => {
    const ref = sceneRef.current
    if (!ref || satellites.length === 0) return
    const { scene, satMeshes } = ref

    // Clear old meshes + lines
    satMeshes.forEach(({ mesh, line }) => {
      scene.remove(mesh)
      scene.remove(line)
    })
    satMeshes.length = 0

    satellites.forEach((sat, i) => {
      const orbitR = scaledRadius(sat.distance)
      const satPos = latLngToVec3(sat.lat, sat.lng, orbitR)
      const surfacePos = latLngToVec3(sat.lat, sat.lng, EARTH_RADIUS)

      // Alternate colors for variety
      const colors = [0x00e5ff, 0x7ee8a2, 0xff9f43, 0xff6b9d, 0xa29bfe]
      const mesh = makeSatelliteMesh(colors[i % colors.length])
      mesh.position.copy(satPos)
      mesh.lookAt(0, 0, 0)  // orient panels toward Earth
      mesh.userData = { satellite: sat, index: i }
      scene.add(mesh)

      const line = makeDashedLine(surfacePos, satPos)
      scene.add(line)

      satMeshes.push({ mesh, line, satellite: sat })
    })
  }, [satellites])

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback((e) => {
    const ref = sceneRef.current
    if (!ref) return
    const { camera, raycaster, satMeshes } = ref
    const el = mountRef.current
    const rect = el.getBoundingClientRect()

    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left)  / rect.width)  * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )

    raycaster.setFromCamera(mouse, camera)

    // Flatten all child meshes for intersection testing
    const targets = []
    satMeshes.forEach(({ mesh }) => {
      mesh.traverse(child => { if (child.isMesh) targets.push(child) })
    })

    const hits = raycaster.intersectObjects(targets)
    if (hits.length === 0) {
      setSelected(null)
      return
    }

    // Walk up to find the group with userData
    let obj = hits[0].object
    while (obj && !obj.userData.satellite) obj = obj.parent

    if (!obj) return

    const sat = obj.userData.satellite
    const screenPos = vec3ToScreen(obj.position, camera, rect.width, rect.height)

    setSelected({ satellite: sat, screenX: screenPos.x, screenY: screenPos.y })
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100vh', background: '#060b18', position: 'relative', fontFamily: 'monospace' }}>

      {/* Canvas mount */}
      <div
        ref={mountRef}
        style={{ width: '100%', height: '100%' }}
        onClick={handleClick}
      />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 20, left: 24,
        color: '#fff', fontSize: 13, letterSpacing: '0.12em',
        textTransform: 'uppercase', opacity: 0.7,
      }}>
        LaunchOps Mission Control
      </div>

      {/* Satellite count badge */}
      {!loading && !error && (
        <div style={{
          position: 'absolute', top: 20, right: 24,
          background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)',
          color: '#00e5ff', fontSize: 12, padding: '4px 12px',
          borderRadius: 20, letterSpacing: '0.08em',
        }}>
          {satellites.length} satellites overhead
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00e5ff', fontSize: 13, letterSpacing: '0.1em',
        }}>
          Fetching satellites...
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#ff6b6b', fontSize: 13,
        }}>
          Error: {error}
        </div>
      )}

      {/* Info card — appears near clicked satellite */}
      {selected && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: Math.min(selected.screenX + 16, mountRef.current?.clientWidth - 260 || 0),
            top:  Math.min(selected.screenY - 20,  mountRef.current?.clientHeight - 220 || 0),
            width: 240,
            background: 'rgba(10,15,40,0.92)',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 12,
            padding: '16px 18px',
            color: '#c9d8f0',
            fontSize: 12,
            lineHeight: 1.8,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          {/* Close */}
          <button
            onClick={() => setSelected(null)}
            style={{
              position: 'absolute', top: 10, right: 12,
              background: 'none', border: 'none',
              color: '#7090a0', cursor: 'pointer', fontSize: 16,
            }}
          >×</button>

          <div style={{ color: '#00e5ff', fontWeight: 700, fontSize: 14, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {selected.satellite.name}
          </div>

          <Row label="NORAD ID"     value={selected.satellite.noradId} />
          <Row label="Int'l Desig"  value={selected.satellite.intlDesig} />
          <Row label="Launch Date"  value={selected.satellite.launchDate} />
          <Row label="Latitude"     value={`${selected.satellite.lat?.toFixed(2)}°`} />
          <Row label="Longitude"    value={`${selected.satellite.lng?.toFixed(2)}°`} />
          <Row label="Altitude"     value={`${selected.satellite.distance?.toFixed(2)} km`} />
        </div>
      )}

      {/* Drag hint */}
      <div style={{
        position: 'absolute', bottom: 20, left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.25)', fontSize: 11, letterSpacing: '0.1em',
        pointerEvents: 'none',
      }}>
        drag to rotate · scroll to zoom · click satellite for info
      </div>
    </div>
  )
}

// ─── Small helper row for the info card ──────────────────────────────────────
function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: '#4a6a80', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ color: '#c9d8f0' }}>{value}</span>
    </div>
  )
}
