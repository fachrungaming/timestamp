import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  Square,
  Clock,
  Zap,
  ZapOff,
  RefreshCcw,
  Image as ImageIcon,
  Trash2,
  X,
  MapPin,
  CircleDot,
  User,
  ZoomIn,
  ZoomOut,
  Timer as TimerIcon,
  Plus,
  Minus
} from 'lucide-react';

const App = () => {
  // --- State Management ---
  const [mode, setMode] = useState('photo'); // 'photo', 'video', 'square', 'timelapse'
  const [flash, setFlash] = useState('off'); // 'off', 'on', 'auto'
  const [cameraFacing, setCameraFacing] = useState('back'); // 'back', 'front'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [captures, setCaptures] = useState([]);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showFlashEffect, setShowFlashEffect] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [timer, setTimer] = useState(0); // 0, 3, 10
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);

  // State baru untuk lokasi
  const [selectedLocation, setSelectedLocation] = useState('Terminal Utama');
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const lokasiOptions = ['Terminal Utama', 'Terminal Selatan', 'Terminal Existing', 'UPG_Airport'];

  // State baru untuk teknisi
  const [technicianName, setTechnicianName] = useState('Fachrun');
  const [showTechnicianMenu, setShowTechnicianMenu] = useState(false);

  // Refs for Camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [stream, setStream] = useState(null);
  const timerTimeoutRef = useRef(null);

  // --- Initialize Camera ---
  useEffect(() => {
    let activeStream = null;
    const startCamera = async () => {
      // Clear existing tracks from the state stream before starting a new one
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: cameraFacing === 'back' ? 'environment' : 'user',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      try {
        console.log("Attempting to start camera with ideal constraints...");
        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
        setStream(activeStream);
      } catch (err) {
        console.warn("Retrying with default constraints due to error:", err);
        try {
          // Fallback to basic settings
          activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = activeStream;
          }
          setStream(activeStream);
        } catch (fallbackErr) {
          console.error("All camera access attempts failed:", fallbackErr);
          // Show user-friendly overlay or alert
        }
      }
    };

    startCamera();
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraFacing]);

  // --- Waktu Real-time untuk Timestamp ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Timer Perekaman Video/Timelapse ---
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // --- Helper Functions ---
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCapture = () => {
    if (isCountingDown) {
      setIsCountingDown(false);
      setCountdown(0);
      if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
      return;
    }

    if (timer > 0 && !isRecording) {
      setIsCountingDown(true);
      setCountdown(timer);
    } else {
      performCapture();
    }
  };

  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      timerTimeoutRef.current = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (isCountingDown && countdown === 0) {
      setIsCountingDown(false);
      performCapture();
    }
    return () => clearTimeout(timerTimeoutRef.current);
  }, [isCountingDown, countdown]);

  const performCapture = () => {
    if (mode === 'video' || mode === 'timelapse') {
      if (isRecording) {
        // Stop recording
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } else {
        // Start recording
        startRecording();
      }
    } else {
      // Capture Photo
      triggerFlashEffect();
      capturePhoto();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Calculate zoom transformation
    const dw = canvas.width / zoom;
    const dh = canvas.height / zoom;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;

    // Draw video frame to canvas with zoom
    context.drawImage(video, dx, dy, dw, dh, 0, 0, canvas.width, canvas.height);

    // Apply Square crop if needed
    let finalDataUrl;
    if (mode === 'square') {
      const size = Math.min(canvas.width, canvas.height);
      const startX = (canvas.width - size) / 2;
      const startY = (canvas.height - size) / 2;

      const squareCanvas = document.createElement('canvas');
      squareCanvas.width = size;
      squareCanvas.height = size;
      const sqCtx = squareCanvas.getContext('2d');
      sqCtx.drawImage(canvas, startX, startY, size, size, 0, 0, size, size);

      // Add Burn-in Timestamp for documentation
      drawBurnInTimestamp(sqCtx, size, size);
      finalDataUrl = squareCanvas.toDataURL('image/jpeg', 0.8);
    } else {
      // Add Burn-in Timestamp for documentation
      drawBurnInTimestamp(context, canvas.width, canvas.height);
      finalDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    }

    const newCapture = {
      id: Date.now(),
      type: mode,
      url: finalDataUrl,
      timestamp: currentDate.toLocaleString('id-ID'),
      location: selectedLocation,
      technician: technicianName
    };
    setCaptures([newCapture, ...captures]);
  };

  const drawBurnInTimestamp = (ctx, width, height) => {
    const padding = 20;
    const boxWidth = 250;
    const boxHeight = 100;
    const x = 20;
    const y = height - boxHeight - 20;

    // Semi-transparent overlay box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x, y, boxWidth, boxHeight);

    // Accent line
    ctx.fillStyle = '#22d3ee'; // cyan-400
    ctx.fillRect(x, y, 4, boxHeight);

    // Text details
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('DEPT. AIRPORT TECHNOLOGY', x + 15, y + 25);

    ctx.fillStyle = 'white';
    ctx.font = '14px Courier New';
    ctx.fillText(currentDate.toLocaleString('id-ID'), x + 15, y + 50);
    ctx.fillText(`LOKASI: ${selectedLocation}`, x + 15, y + 70);
    ctx.fillText(`TEKNISI: ${technicianName}`, x + 15, y + 90);
  };

  const startRecording = () => {
    const chunks = [];
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      const newCapture = {
        id: Date.now(),
        type: mode,
        url: videoUrl,
        duration: recordingTime,
        timestamp: currentDate.toLocaleString('id-ID'),
        location: selectedLocation,
        technician: technicianName
      };
      setCaptures([newCapture, ...captures]);
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const triggerFlashEffect = () => {
    setShowFlashEffect(true);
    setTimeout(() => setShowFlashEffect(false), 150);
  };

  const handleDelete = (id) => {
    setCaptures(captures.filter(c => c.id !== id));
    setSelectedMedia(null); // Tutup media view jika sedang dibuka
  };

  const toggleFlash = () => {
    const modes = ['off', 'on', 'auto'];
    const nextIndex = (modes.indexOf(flash) + 1) % modes.length;
    setFlash(modes[nextIndex]);
  };

  // --- Komponen Layar Galeri ---
  if (isGalleryOpen) {
    return (
      <div className="flex flex-col h-screen bg-black text-white font-sans">
        {/* Header Galeri */}
        <div className="flex items-center justify-between p-4 bg-zinc-900">
          <button onClick={() => setIsGalleryOpen(false)} className="p-2">
            <X size={24} />
          </button>
          <h2 className="text-lg font-semibold">Galeri Dokumentasi</h2>
          <div className="w-8"></div> {/* Spacer */}
        </div>

        {/* Fullscreen Media Viewer */}
        {selectedMedia ? (
          <div className="flex-1 flex flex-col relative bg-black">
            {selectedMedia.type === 'video' || selectedMedia.type === 'timelapse' ? (
              <video
                src={selectedMedia.url}
                controls
                autoPlay
                className="flex-1 object-contain w-full h-full"
              />
            ) : (
              <img
                src={selectedMedia.url}
                alt="Preview"
                className="flex-1 object-contain w-full h-full"
              />
            )}
            {/* Timestamp Overlay di Preview */}
            <div className="absolute bottom-20 left-4 text-xs text-white bg-black/40 p-2 rounded shadow">
              <p className="font-bold text-cyan-400">Dept. Airport Technology</p>
              <p>{selectedMedia.timestamp}</p>
              <p className="flex items-center gap-1"><MapPin size={10} /> Lokasi: {selectedMedia.location || 'Terminal Utama'}</p>
              <p className="pl-3.5">Teknisi: {selectedMedia.technician || 'Fachrun'}</p>
            </div>

            {/* Kontrol Media */}
            <div className="absolute top-4 right-4 flex gap-4">
              <button onClick={() => handleDelete(selectedMedia.id)} className="p-3 bg-red-600/80 rounded-full text-white">
                <Trash2 size={20} />
              </button>
            </div>
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-4 left-4 p-3 bg-black/50 rounded-full text-white"
            >
              <X size={20} />
            </button>
          </div>
        ) : (
          /* Grid Galeri */
          <div className="flex-1 overflow-y-auto p-1">
            {captures.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <ImageIcon size={48} className="mb-2 opacity-50" />
                <p>Belum ada dokumentasi</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {captures.map((cap) => (
                  <div
                    key={cap.id}
                    className="aspect-square bg-zinc-800 relative cursor-pointer"
                    onClick={() => setSelectedMedia(cap)}
                  >
                    {cap.type === 'video' || cap.type === 'timelapse' ? (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                        <Video size={32} className="text-zinc-500" />
                        <div className="absolute inset-0 bg-black/20"></div>
                      </div>
                    ) : (
                      <img src={cap.url} alt="thumbnail" className="w-full h-full object-cover" />
                    )}

                    {(cap.type === 'video' || cap.type === 'timelapse') && (
                      <div className="absolute bottom-1 right-1 bg-red-600 px-1 rounded text-[10px] flex items-center gap-1 font-bold">
                        <CircleDot size={8} /> {formatTime(cap.duration || 0)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- Layar Utama Kamera ---
  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">

      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-20">
        <button onClick={toggleFlash} className="p-2 rounded-full hover:bg-white/10 transition">
          {flash === 'off' ? <ZapOff size={24} /> : <Zap size={24} className={flash === 'on' ? 'text-yellow-400' : 'text-white'} />}
          {flash === 'auto' && <span className="absolute text-[8px] font-bold mt-1 ml-4 bg-black rounded px-0.5">A</span>}
        </button>

        {/* Indikator Perekaman */}
        {isRecording && (
          <div className="flex items-center gap-2 bg-red-600/80 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
            <CircleDot size={12} />
            {formatTime(recordingTime)}
          </div>
        )}

        <button onClick={() => setCameraFacing(prev => prev === 'back' ? 'front' : 'back')} className="p-2 rounded-full hover:bg-white/10 transition bg-black/20 backdrop-blur-sm">
          <RefreshCcw size={24} />
        </button>
      </div>

      {/* Viewfinder Area */}
      <div className={`relative flex-1 bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${mode === 'square' ? 'aspect-square mt-20' : ''}`}>

        {/* Real-time Video Stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            transform: `${cameraFacing === 'front' ? 'scaleX(-1)' : ''} scale(${zoom})`
          }}
          className={`w-full h-full object-cover transition-all duration-300`}
        />

        {/* Timer Visualization */}
        {isCountingDown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-40">
            <div className="text-8xl font-bold font-mono text-white animate-ping">
              {countdown}
            </div>
          </div>
        )}

        {/* Zoom Control Slider (Floating on Viewfinder) */}
        <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col items-center gap-4 bg-black/40 backdrop-blur-md p-2 rounded-full border border-white/20 z-30">
          <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 3))} className="p-1.5 hover:bg-white/20 rounded-full transition">
            <Plus size={20} />
          </button>
          <div className="h-32 w-1.5 bg-white/20 rounded-full relative overflow-hidden">
            <div
              className="absolute bottom-0 left-0 w-full bg-cyan-400 transition-all duration-200"
              style={{ height: `${((zoom - 1) / 2) * 100}%` }}
            ></div>
          </div>
          <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 1))} className="p-1.5 hover:bg-white/20 rounded-full transition">
            <Minus size={20} />
          </button>
          <span className="text-[10px] font-bold text-cyan-400">{zoom.toFixed(1)}x</span>
        </div>

        {/* Hidden Canvas for Capturing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Grid Overlay for technical reference */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="w-full h-full opacity-20" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: 'clamp(20px, 5vw, 40px) clamp(20px, 5vw, 40px)' }}></div>
        </div>

        {/* Efek Flash Putih */}
        {showFlashEffect && <div className="absolute inset-0 bg-white z-50"></div>}

        {/* Garis Bantu Tengah (Crosshair) */}
        <div className="absolute w-8 h-[1px] bg-white/50"></div>
        <div className="absolute h-8 w-[1px] bg-white/50"></div>

        {/* Timestamp Overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-col items-start drop-shadow-md z-10 pointer-events-none">
          <div className="bg-black/50 backdrop-blur-sm p-3 rounded-lg border-l-4 border-cyan-400 pointer-events-auto">
            <h1 className="text-cyan-400 font-bold text-sm mb-1 uppercase tracking-wider">Dept. Airport Technology</h1>
            <div className="text-white text-xs space-y-0.5 font-mono">
              <button
                onClick={() => setShowLocationMenu(true)}
                className="flex items-center gap-1.5 hover:bg-white/10 p-0.5 -ml-0.5 rounded transition w-full text-left"
              >
                <MapPin size={12} className="text-red-400 shrink-0" />
                <span className="truncate">Lokasi: {selectedLocation}</span>
                <span className="ml-auto text-[9px] bg-white/20 px-1 rounded">Ubah</span>
              </button>
              <button
                onClick={() => setShowTechnicianMenu(true)}
                className="flex items-center gap-1.5 hover:bg-white/10 p-0.5 -ml-0.5 rounded transition w-full text-left"
              >
                <User size={12} className="text-blue-400 shrink-0" />
                <span className="truncate">Teknisi: {technicianName}</span>
                <span className="ml-auto text-[9px] bg-white/20 px-1 rounded">Ubah</span>
              </button>
              <p className="pl-4 mt-1 text-yellow-300">
                {currentDate.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} | {currentDate.toLocaleTimeString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Pemilihan Lokasi */}
        {showLocationMenu && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-zinc-900 rounded-xl p-4 w-full max-w-sm border border-zinc-700 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-white">Pilih Lokasi</h3>
                <button onClick={() => setShowLocationMenu(false)} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {lokasiOptions.map(loc => (
                  <button
                    key={loc}
                    onClick={() => {
                      setSelectedLocation(loc);
                      setShowLocationMenu(false);
                    }}
                    className={`p-3 rounded-lg text-left transition-colors font-medium ${selectedLocation === loc
                      ? 'bg-cyan-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Ubah Teknisi */}
        {showTechnicianMenu && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-zinc-900 rounded-xl p-4 w-full max-w-sm border border-zinc-700 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-white">Ubah Nama Teknisi</h3>
                <button onClick={() => setShowTechnicianMenu(false)} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="w-full bg-zinc-800 text-white p-3 rounded-lg border border-zinc-700 focus:outline-none focus:border-cyan-500"
                  placeholder="Masukkan nama teknisi"
                  autoFocus
                />
                <button
                  onClick={() => setShowTechnicianMenu(false)}
                  className="w-full p-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors font-medium"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="pb-8 pt-4 px-4 bg-black z-20 flex flex-col gap-6">

        {/* Mode Selector */}
        <div className="flex justify-center gap-6 overflow-x-auto text-sm font-medium no-scrollbar">
          <button
            onClick={() => !isRecording && setMode('timelapse')}
            className={`transition ${mode === 'timelapse' ? 'text-cyan-400 font-bold' : 'text-zinc-500'}`}
          >
            SELANG WAKTU
          </button>
          <button
            onClick={() => !isRecording && setMode('video')}
            className={`transition ${mode === 'video' ? 'text-cyan-400 font-bold' : 'text-zinc-500'}`}
          >
            VIDEO
          </button>
          <button
            onClick={() => !isRecording && setMode('photo')}
            className={`transition ${mode === 'photo' ? 'text-cyan-400 font-bold' : 'text-zinc-500'}`}
          >
            FOTO
          </button>
          <button
            onClick={() => !isRecording && setMode('square')}
            className={`transition ${mode === 'square' ? 'text-cyan-400 font-bold' : 'text-zinc-500'}`}
          >
            PERSEGI
          </button>
        </div>

        {/* Shutter & Gallery Row */}
        <div className="flex items-center justify-between px-6">
          {/* Gallery Button */}
          <button
            onClick={() => setIsGalleryOpen(true)}
            className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center relative"
          >
            {captures.length > 0 ? (
              <img src={captures[0].url} alt="Last capture" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={24} className="text-zinc-400" />
            )}
            {captures.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-cyan-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {captures.length}
              </span>
            )}
          </button>

          {/* Shutter Button */}
          <button
            onClick={handleCapture}
            className={`w-20 h-20 rounded-full border-4 p-1 transition-all duration-200 ${mode === 'video' || mode === 'timelapse' ? 'border-red-500' : 'border-white'
              }`}
          >
            <div className={`w-full h-full rounded-full transition-all duration-300 ${(mode === 'video' || mode === 'timelapse')
              ? (isRecording ? 'bg-red-500 scale-50 rounded-lg' : 'bg-red-500')
              : 'bg-white'
              }`}></div>
          </button>

          {/* Timer Toggle Button (Moved from features row to settings spot) */}
          <button
            onClick={() => setTimer(prev => prev === 0 ? 3 : prev === 3 ? 10 : 0)}
            className={`w-14 h-14 rounded-full bg-zinc-900/50 backdrop-blur-sm flex flex-col items-center justify-center transition ${timer > 0 ? 'text-cyan-400' : 'text-zinc-400'}`}
          >
            <TimerIcon size={24} />
            <span className="text-[9px] font-bold mt-0.5">{timer === 0 ? 'OFF' : `${timer}S`}</span>
          </button>
        </div>
      </div>
    </div >
  );
};

export default App;
