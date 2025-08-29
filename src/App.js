import { useRef, useState, useEffect } from "react";
import { JsonRpcProvider, Contract, BrowserProvider } from "ethers";
import "./App.css";

const INFURA_URL =
  "https://mainnet.infura.io/v3/a94316d3aff1412d92fe781baee26a67"; // I don't know how to secure this. Don't be a jerk

const CRYPTOPUNKS_ADDRESS = "0x16f5a35647d6f03d5d3da7b35409d65ba03af3b2";
const MOONCATS_SVG_ADDRESS = "0xB39C61fe6281324A23e079464f7E697F8Ba6968f";

const cryptopunksABI = [
  "function punkImageSvg(uint16 index) view returns (string)",
];

const mooncatsABI = [
  "function imageOf(uint256 rescueOrder, bool glow) view returns (string)",
];

const SVG_WIDTH = 480;
const SVG_HEIGHT = 480;
const DEFAULT_CAT_SCALE = 0.6;

// Returns a working provider: tries Infura first, then window.ethereum
async function getProvider(setErrorMsg, connected) {
  // If wallet is connected, always use it!
  if (connected && window.ethereum) {
    try {
      const browserProvider = new BrowserProvider(window.ethereum);
      await browserProvider.getBlockNumber(); // Optional: verify connection
      return browserProvider;
    } catch (walletErr) {
      setErrorMsg("Wallet provider unavailable. Please try again later.");
      return null;
    }
  }
  // Otherwise, try Infura
  try {
    const infuraProvider = new JsonRpcProvider(INFURA_URL);
    // await infuraProvider.getBlockNumber();
    return infuraProvider;
  } catch (err) {
    setErrorMsg("Infura unavailable.");
    return null;
  }
}

export default function MoonCatPunkComposer() {
  const dragRef = useRef({
    dragging: false,
    startCat: { x: 0, y: 0 },
    startPunk: { x: 0, y: 0 },
    startX: 0,
    startY: 0,
    svg: null,
  });

  const [providerReady, setProviderReady] = useState(false);
  const [mode5997, setMode5997] = useState(false);
  const [connected, setConnected] = useState(false);
  const [canvasBg, setCanvasBg] = useState("#fff");
  const [autoCrop, setAutoCrop] = useState(true);

  // NFT input state
  const [punkId, setPunkId] = useState(0);
  const [catId, setCatId] = useState(0);

  const debouncedPunkId = useDebounce(punkId, 400); // 400ms delay
  const debouncedCatId = useDebounce(catId, 400);

  // SVG state
  const [punkSVG, setPunkSVG] = useState(null);
  const [catSVG, setCatSVG] = useState(null);

  // Cat placement state
  // Default: center horizontally, a bit above punk head
  const DEFAULT_CAT_X = SVG_WIDTH / 2 - 24;
  const DEFAULT_CAT_Y = 20;

  const catPosRef = useRef({ x: DEFAULT_CAT_X, y: DEFAULT_CAT_Y });
  const punkPosRef = useRef({ x: 0, y: 0 });

  const [catX, setCatX] = useState(DEFAULT_CAT_X);
  const [catY, setCatY] = useState(DEFAULT_CAT_Y);
  const [catScale, setCatScale] = useState(DEFAULT_CAT_SCALE);

  const [punkX, setPunkX] = useState(0);
  const [punkY, setPunkY] = useState(0);
  const [punkScale, setPunkScale] = useState(1);

  // Loading/error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    catPosRef.current = { x: catX, y: catY };
    punkPosRef.current = { x: punkX, y: punkY };
  }, [catX, catY, punkX, punkY]);

  useEffect(() => {
    function handleMove(e2) {
      if (!dragRef.current.dragging) return;
      const isTouch = e2.type === "touchmove";
      const moveEvent = isTouch ? e2.touches[0] : e2;
      const { svg, startCat, startPunk, startX, startY } = dragRef.current;

      if (!svg) return;

      const pt2 = svg.createSVGPoint();
      pt2.x = moveEvent.clientX;
      pt2.y = moveEvent.clientY;
      const curr = pt2.matrixTransform(svg.getScreenCTM().inverse());
      if (mode5997) {
        setPunkX(startPunk.x + (curr.x - startX));
        setPunkY(startPunk.y + (curr.y - startY));
      } else {
        setCatX(startCat.x + (curr.x - startX));
        setCatY(startCat.y + (curr.y - startY));
      }
    }

    function handleUp() {
      dragRef.current.dragging = false;
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp, { passive: false });

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove, { passive: false });
      window.removeEventListener("touchend", handleUp, { passive: false });
    };
  }, [mode5997]);

  function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
  }

  // Calculate optimal viewBox for cropping
  const getOptimalViewBox = () => {
    if (!autoCrop || !punkSVG || mode5997) {
      return `0 0 ${SVG_WIDTH} ${SVG_HEIGHT + 200}`;
    }

    // Standard punk dimensions are 24x24, scaled up to 480x480 (20x scale)
    const punkWidth = 480;
    const punkHeight = 480;
    
    // Calculate punk bounds precisely
    let punkLeft = punkX;
    let punkTop = punkY;
    let punkRight = punkX + (punkWidth * punkScale);
    let punkNeckY = punkY + (punkHeight * punkScale);

    // In normal mode, punk is at 0,0
    if (!mode5997) {
      punkLeft = 0;
      punkTop = 0;
      punkRight = punkWidth;
      punkNeckY = punkHeight;
    }

    // FIXED: Bottom boundary is always at punk neck (no downward expansion)
    const fixedBottom = punkNeckY;

    // Start with punk bounds for horizontal and upward expansion
    let contentLeft = punkLeft;
    let contentTop = punkTop;
    let contentRight = punkRight;

    // Add cat bounds if visible (but don't let cat expand downward past punk neck)
    if (catSVG) {
      const catWidth = 64;
      const catHeight = 64;
      
      let catLeft = catX;
      let catTop = catY;
      let catRight = catX + (catWidth * catScale);

      // In 5997 mode, cat is at fixed position
      if (mode5997) {
        catLeft = 50;
        catTop = 120;
        catRight = 50 + (catWidth * 2);
      }

      // Expand bounds to include cat (leftward, rightward, upward only)
      contentLeft = Math.min(contentLeft, catLeft);
      contentTop = Math.min(contentTop, catTop); // Can expand upward
      contentRight = Math.max(contentRight, catRight);
      // Note: we don't expand contentBottom based on cat position
    }

    // Calculate dimensions with fixed bottom
    const finalLeft = contentLeft;
    const finalTop = contentTop;
    const finalRight = contentRight;
    const finalBottom = fixedBottom; // Always fixed at punk neck
    
    const finalWidth = finalRight - finalLeft;
    const finalHeight = finalBottom - finalTop;

    // Ensure minimum dimensions by expanding upward and outward only
    const minWidth = 200;
    const minHeight = 200;
    
    let adjustedLeft = finalLeft;
    let adjustedTop = finalTop;
    let adjustedWidth = Math.max(minWidth, finalWidth);
    let adjustedHeight = Math.max(minHeight, finalHeight);

    // If we need to expand width, expand equally left and right
    if (adjustedWidth > finalWidth) {
      const widthDiff = adjustedWidth - finalWidth;
      adjustedLeft = finalLeft - (widthDiff / 2);
    }

    // If we need to expand height, expand upward only (keep bottom fixed)
    if (adjustedHeight > finalHeight) {
      const heightDiff = adjustedHeight - finalHeight;
      adjustedTop = finalTop - heightDiff; // Expand upward only
    }

    // Round to avoid sub-pixel rendering issues
    return `${Math.round(adjustedLeft * 10) / 10} ${Math.round(adjustedTop * 10) / 10} ${Math.round(adjustedWidth * 10) / 10} ${Math.round(adjustedHeight * 10) / 10}`;
  };

  // Download function
  const handleDownload = async () => {
    const svg = document.getElementById("mooncat-svg-canvas");
    if (!svg) return;

    try {
      // Clone the SVG to avoid modifying the original
      const svgClone = svg.cloneNode(true);
      svgClone.setAttribute('width', '800');
      svgClone.setAttribute('height', '800');
      
      // Remove the border from the downloaded version
      svgClone.style.border = 'none';
      
      // Create a temporary container
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.appendChild(svgClone);
      document.body.appendChild(tempDiv);

      // Convert SVG to string
      const svgData = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      
      // Direct SVG download
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `punk-${punkId}-cat-${catId}.svg`;
      link.click();
      URL.revokeObjectURL(url);    
      
      // Clean up
      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error('Download failed:', error);
      setErrorMsg('Download failed. Please try again.');
    }
  };

  const [pngImageSrc, setPngImageSrc] = useState(null);

  const generatePNG = async () => {
    const svg = document.getElementById("mooncat-svg-canvas");
    if (!svg) return;

    try {
      // Clone the SVG to avoid modifying the original
      const svgClone = svg.cloneNode(true);
      svgClone.setAttribute('width', '800');
      svgClone.setAttribute('height', '800');
      svgClone.style.border = 'none';
      
      // Create a temporary container
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.appendChild(svgClone);
      document.body.appendChild(tempDiv);

      // Convert SVG to string
      const svgData = new XMLSerializer().serializeToString(svgClone);
      
      // Convert to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      // Use higher resolution for better pixel art rendering
      const scale = 16;
      canvas.width = 800 * scale;
      canvas.height = 800 * scale;
      
      img.onload = () => {
        // Disable all smoothing for pixel-perfect rendering
        ctx.imageSmoothingEnabled = false;
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.msImageSmoothingEnabled = false;
        
        // Fill background
        ctx.fillStyle = canvasBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Scale back down
        const outputCanvas = document.createElement('canvas');
        const outputCtx = outputCanvas.getContext('2d');
        outputCanvas.width = 800;
        outputCanvas.height = 800;
        
        outputCtx.imageSmoothingEnabled = false;
        outputCtx.webkitImageSmoothingEnabled = false;
        outputCtx.mozImageSmoothingEnabled = false;
        outputCtx.msImageSmoothingEnabled = false;
        
        outputCtx.drawImage(canvas, 0, 0, 800, 800);
        
        // Convert to data URL for right-click saving
        const dataUrl = outputCanvas.toDataURL('image/png');
        setPngImageSrc(dataUrl);
      };
      
      // Ensure pixel-perfect SVG rendering
      const pixelPerfectSvgData = svgData.replace('<svg', '<svg shape-rendering="crispEdges" image-rendering="pixelated"');
      const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(pixelPerfectSvgData)));
      img.src = svgDataUrl;
      
      // Clean up
      document.body.removeChild(tempDiv);
      console.log("done");
    } catch (error) {
      console.error('PNG generation failed:', error);
      setErrorMsg('PNG generation failed. Please try again.');
    }
  };

  // Wallet connect handler
  const handleConnectWallet = async () => {
    if (window.ethereum) {
      try {
        setErrorMsg(null);
        setLoading(true);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        setConnected(true);
        console.log("connected");
      } catch (err) {
        console.error("Wallet connection error:", err);
        setErrorMsg("Wallet connection denied.");
      }
    } else {
      setErrorMsg("No Ethereum provider found. Please install MetaMask.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!providerReady && !connected) return;
    let isMounted = true;
    const fetchPunkSVG = async () => {
      setLoading(true);
      console.log("getting punk");
      try {
        const provider = await getProvider(setErrorMsg, connected);

        const punkContract = new Contract(
          CRYPTOPUNKS_ADDRESS,
          cryptopunksABI,
          provider,
        );
        const punkIdx = Math.max(0, Math.min(9999, debouncedPunkId));
        const punk = await punkContract.punkImageSvg(punkIdx);
        if (isMounted) setPunkSVG(punk);
      } catch (error) {
        if (isMounted)
          setErrorMsg("Failed to fetch Punk SVG: " + error.message);
      }
      setLoading(false);
    };
    fetchPunkSVG();
    return () => {
      isMounted = false;
    };
  }, [debouncedPunkId, providerReady, connected]); // Only runs when punkId changes

  // Fetch cat SVG only when catId changes
  useEffect(() => {
    if (!providerReady && !connected) return;
    let isMounted = true;
    const fetchCatSVG = async () => {
      setLoading(true);
      console.log("getting cat");
      try {
        const provider = await getProvider(setErrorMsg, connected);

        const mooncatContract = new Contract(
          MOONCATS_SVG_ADDRESS,
          mooncatsABI,
          provider,
        );
        const catIdx = Math.max(0, Math.min(25439, debouncedCatId));
        const cat = await mooncatContract.imageOf(catIdx, false);
        if (isMounted) setCatSVG(cat);
      } catch (error) {
        if (isMounted) setErrorMsg("Failed to fetch Cat SVG: " + error.message);
      }
      setLoading(false);
    };
    fetchCatSVG();
    return () => {
      isMounted = false;
    };
  }, [debouncedCatId, providerReady, connected]); // Only runs when catId changes

  useEffect(() => {
    (async () => {
      try {
        const infuraProvider = new JsonRpcProvider(INFURA_URL);
        await infuraProvider.getBlockNumber();
        setProviderReady(true);
        setErrorMsg(null);
      } catch (err) {
        setProviderReady(false);
        setErrorMsg("Infura unavailable. Please connect your wallet!");
      }
    })();
  }, []);

  // Handle account change in wallet
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts) => {
      if (accounts.length === 0) {
        setConnected(false);
      } else {
        setConnected(true);
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum.removeListener("accountsChanged", handler);
  }, []);

  const handleItemMouseDown = (e) => {
    e.preventDefault();
    const isTouch = e.type === "touchstart";
    const startEvent = isTouch ? e.touches[0] : e;
    const svg = document.getElementById("mooncat-svg-canvas");
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = startEvent.clientX;
    pt.y = startEvent.clientY;
    const start = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (mode5997) {
      dragRef.current = {
        dragging: true,
        startCat: { ...catPosRef.current },
        startPunk: { ...punkPosRef.current },
        startX: start.x,
        startY: start.y,
        svg,
      };
    } else {
      dragRef.current = {
        dragging: true,
        startCat: { ...catPosRef.current },
        startPunk: { ...punkPosRef.current },
        startX: start.x,
        startY: start.y,
        svg,
      };
    }
  };

  // Reset position/scale
  const handleReset = () => {
    setCatX(DEFAULT_CAT_X);
    setCatY(DEFAULT_CAT_Y);
    setCatScale(DEFAULT_CAT_SCALE);
  };

  const handleModeToggle = () => {
    setMode5997((prev) => {
      // When turning ON, reset punk controls and center punk
      if (!prev) {
        setPunkX(0);
        setPunkY(0);
        setPunkScale(0.5);
      } else {
        // When turning OFF, reset cat controls and center cat
        setCatX(0);
        setCatY(0);
        setCatScale(0.6);
      }
      return !prev;
    });
  };

  return (
    <div className="mooncat-container">
      <h1 className="mooncat-title">MoonCat on Punk Composer</h1>
      <p className="mooncat-blurb">
        This tool reads CryptoPunks and MoonCats directly from Ethereum. Your
        wallet provides a free connection to access on-chain data without
        relying on external APIs.
        <br />
        <strong>
          This site will never ask for a transaction after connecting.
        </strong>
        <br />
        Use a throwaway wallet. Does not check your holdings
      </p>

      {!providerReady && !connected && (
        <button
          className="mooncat-connect-btn"
          onClick={handleConnectWallet}
          disabled={loading}
        >
          {loading ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {errorMsg && <div className="mooncat-error">{errorMsg}</div>}

      {/* Only show controls and canvas if connected */}
      {(providerReady || connected) && (
        <>
          <div className="mooncat-form">
            <div className="mooncat-input-group">
              <div>
                <label className="mooncat-label">CryptoPunk ID</label>
                <input
                  type="number"
                  value={punkId}
                  min={0}
                  max={9999}
                  onChange={(e) =>
                    setPunkId(
                      Math.max(0, Math.min(9999, Number(e.target.value))),
                    )
                  }
                  className="mooncat-input"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mooncat-label">MoonCat Rescue #</label>
                <input
                  type="number"
                  value={catId}
                  min={0}
                  onChange={(e) =>
                    setCatId(
                      Math.max(0, Math.min(25439, Number(e.target.value))),
                    )
                  }
                  className="mooncat-input"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Auto-crop toggle */}
            <div className="mooncat-input-group">
              <label className="mooncat-label">
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Auto-crop
              </label>
            </div>


            {mode5997 ? (
              <div className="mooncat-punk-controls" style={{ marginTop: 8 }}>
                <label className="mooncat-size-label">Punk Size</label>
                <div className="mooncat-size-row">
                  <button
                    onClick={() => setPunkScale((s) => Math.max(0.1, s - 0.1))}
                    className="mooncat-size-btn"
                  >
                    −
                  </button>
                  <span className="mooncat-size-value">
                    {punkScale.toFixed(1)}
                  </span>
                  <button
                    onClick={() => setPunkScale((s) => s + 0.1)}
                    className="mooncat-size-btn"
                  >
                    ＋
                  </button>
                </div>
                <button
                  className="mooncat-reset-btn"
                  onClick={() => {
                    setPunkX(0);
                    setPunkY(0);
                    setPunkScale(0.5);
                  }}
                  disabled={loading}
                  style={{ marginTop: 10 }}
                >
                  Reset Punk Position
                </button>
                <div
                  style={{
                    fontSize: "0.95rem",
                    color: "#6b7280",
                    margin: "8px 0 0 0",
                  }}
                >
                  Drag the punk for placement
                </div>
              </div>
            ) : (
              <div className="mooncat-punk-controls" style={{ marginTop: 8 }}>
                <label className="mooncat-size-label">Cat Size</label>
                <div className="mooncat-size-row">
                  <button
                    onClick={() => setCatScale((s) => Math.max(0.1, s - 0.1))}
                    className="mooncat-size-btn"
                  >
                    −
                  </button>
                  <span className="mooncat-size-value">
                    {catScale.toFixed(1)}
                  </span>
                  <button
                    onClick={() => setCatScale((s) => s + 0.1)}
                    className="mooncat-size-btn"
                  >
                    ＋
                  </button>
                </div>
                <div
                  style={{
                    fontSize: "0.95rem",
                    color: "#6b7280",
                    margin: "8px 0 0 0",
                  }}
                >
                  Drag the cat for placement
                </div>
                <button
                  className="mooncat-reset-btn"
                  onClick={handleReset}
                  disabled={loading}
                  style={{ marginTop: 10 }}
                >
                  Reset Cat Position
                </button>
              </div>
            )}

            <div className="mooncat-bg-controls">
              <label className="mooncat-label" style={{ marginBottom: 4 }}>
                Canvas Background
              </label>
              <div className="mooncat-bg-presets">
                <button
                  type="button"
                  onClick={() => setCanvasBg("#fff")}
                  style={{
                    background: "#fff",
                    color: "#222",
                    border:
                      canvasBg === "#fff"
                        ? "2px solid #4f46e5"
                        : "1px solid #d1d5db",
                  }}
                >
                  White
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasBg("#608191")}
                  style={{
                    background: "#608191",
                    color: "#fff",
                    border:
                      canvasBg === "#608191"
                        ? "2px solid #4f46e5"
                        : "1px solid #d1d5db",
                  }}
                >
                  Blue
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasBg("#181818")}
                  style={{
                    background: "#181818",
                    color: "#fff",
                    border:
                      canvasBg === "#181818"
                        ? "2px solid #4f46e5"
                        : "1px solid #d1d5db",
                  }}
                >
                  Black
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasBg("#a99dfe")}
                  style={{
                    background: "#a99dfe",
                    color: "#fff",
                    border:
                      canvasBg === "#a99dfe"
                        ? "2px solid #4f46e5"
                        : "1px solid #d1d5db",
                  }}
                >
                  Purple
                </button>
                <input
                  type="color"
                  value={canvasBg}
                  onChange={(e) => setCanvasBg(e.target.value)}
                  style={{
                    marginLeft: 12,
                    border: "none",
                    background: "none",
                    width: 36,
                    height: 32,
                    verticalAlign: "middle",
                  }}
                  title="Custom"
                />
              </div>
            </div>
          </div>
          <div className="mooncat-mode-row">
            <div><button
              className={`mooncat-mode-btn${mode5997 ? " active" : ""}`}
              onClick={handleModeToggle}
              type="button"
              style={{ marginBottom: 12 }}
            >
              5997 Mode 🐱
            </button></div>
            <div>
              <button
                onClick={handleDownload}
                className="mooncat-reset-btn"
                disabled={!punkSVG || !catSVG}
                style={{ 
                  background: '#8b5cf6', 
                  color: 'white',
                  border: 'none',
                  minWidth: 80
                }}
              >
                Download SVG
              </button>

              <button
                onClick={generatePNG}
                className="mooncat-reset-btn"
                disabled={!punkSVG || !catSVG}
                style={{ 
                  background: '#8b5cf6', 
                  color: 'white',
                  border: 'none',
                  minWidth: 80,
                  marginLeft: '10px'
                }}
              >
                Generate PNG
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 4 }}>
              Generate PNG then right-click to copy/save
            </div>
              
            {/* Generated PNG display */}
            {pngImageSrc && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '0.9rem', marginBottom: 8, color: '#374151' }}>
                  Right-click the image below to copy or save:
                </div>
                <img 
                  src={pngImageSrc} 
                  alt="Generated PNG"
                  style={{ 
                    maxWidth: '300px', 
                    border: '2px solid #e5e7eb', 
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  onContextMenu={(e) => {
                    // Allow right-click context menu
                    e.stopPropagation();
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
                  800×800px • Right-click for "Copy image" or "Save image as..."
                </div>
              </div>
            )}
          </div>
          {loading && <div className="mooncat-loading">Loading...</div>}
          <div className="mooncat-canvas-wrapper">
            {punkSVG && catSVG && (
              <svg
                id="mooncat-svg-canvas"
                width={SVG_WIDTH}
                height={SVG_HEIGHT}
                viewBox={getOptimalViewBox()}
                style={{
                  border: "1px solid #eee",
                  background: canvasBg,
                  touchAction: "none",
                }}
              >
                {mode5997 ? (
                  <>
                    {/* Cat is big and static, Punk is draggable & scalable */}
                    <g
                      transform={`translate(50, 120) scale(2)`}
                      dangerouslySetInnerHTML={{ __html: catSVG }}
                    />
                    <g
                      transform={`translate(${punkX},${punkY}) scale(${punkScale})`}
                      style={{ cursor: "grab", touchAction: "none" }}
                      onMouseDown={handleItemMouseDown}
                      onTouchStart={handleItemMouseDown}
                      dangerouslySetInnerHTML={{ __html: punkSVG }}
                    />
                  </>
                ) : (
                  <>
                    {/* Punk is static, Cat is draggable & scalable */}
                    <g dangerouslySetInnerHTML={{ __html: punkSVG }} />
                    <g
                      transform={`translate(${catX},${catY}) scale(${catScale})`}
                      style={{ cursor: "grab", touchAction: "none" }}
                      onMouseDown={handleItemMouseDown}
                      onTouchStart={handleItemMouseDown}
                      dangerouslySetInnerHTML={{ __html: catSVG }}
                    />
                  </>
                )}
              </svg>
            )}
          </div>
        </>
      )}
    </div>
  );
}
