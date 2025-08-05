import { useState, useEffect, useCallback } from "react";
import { Contract, BrowserProvider } from "ethers";
import "./App.css";

const CRYPTOPUNKS_ADDRESS = "0x16f5a35647d6f03d5d3da7b35409d65ba03af3b2";
const MOONCATS_SVG_ADDRESS = "0xB39C61fe6281324A23e079464f7E697F8Ba6968f";

// Tweak these until your MoonCat is properly aligned when dragging!
const MOONCAT_OFFSET_X = 6; // This is usually half the MoonCat's width if SVG is 0 0 24 24
const MOONCAT_OFFSET_Y = 6; // Adjust as needed for perfect vertical alignment

const cryptopunksABI = [
  "function punkImageSvg(uint16 index) view returns (string)",
];

const mooncatsABI = [
  "function imageOf(uint256 rescueOrder, bool glow) view returns (string)",
];

const SVG_WIDTH = 480;
const SVG_HEIGHT = 480;
const PUNK_SIZE = 24; // CryptoPunks are 24x24 SVGs (official)
const DEFAULT_CAT_SCALE = 0.6;

export default function MoonCatPunkComposer() {
  // Wallet state
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState(null);

  const [canvasBg, setCanvasBg] = useState("#fff");

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

  const [catX, setCatX] = useState(DEFAULT_CAT_X);
  const [catY, setCatY] = useState(DEFAULT_CAT_Y);
  const [catScale, setCatScale] = useState(DEFAULT_CAT_SCALE);

  // Loading/error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Log cat position and scale on change (for easy manual adjustment)
  useEffect(() => {
    console.log(`Cat coordinates: X=${catX}, Y=${catY}, Scale=${catScale}`);
  }, [catX, catY, catScale]);

  function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
  }

  // Wallet connect handler
  const handleConnectWallet = async () => {
    if (window.ethereum) {
      try {
        setErrorMsg(null);
        setLoading(true);
        const [addr] = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAddress(addr);
        setConnected(true);
      } catch (err) {
        console.error("Wallet connection error:", err);
        setErrorMsg("Wallet connection denied.");
      }
    } else {
      setErrorMsg("No Ethereum provider found. Please install MetaMask.");
    }
    setLoading(false);
  };

  // Fetch punk & cat SVGs when connected or inputs change
  const fetchAndCompose = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      if (
        typeof window === "undefined" ||
        typeof window.ethereum === "undefined"
      ) {
        throw new Error(
          "No Ethereum provider found. Please install MetaMask, Rabby, or a compatible wallet.",
        );
      }

      const provider = new BrowserProvider(window.ethereum);
      const punkContract = new Contract(
        CRYPTOPUNKS_ADDRESS,
        cryptopunksABI,
        provider,
      );
      const mooncatContract = new Contract(
        MOONCATS_SVG_ADDRESS,
        mooncatsABI,
        provider,
      );

      // Clamp input IDs for safety
      const punkIdx = Math.max(0, Math.min(9999, debouncedPunkId));
      const catIdx = Math.max(0, Math.min(25439, debouncedCatId));

      const punk = await punkContract.punkImageSvg(punkIdx);
      const cat = await mooncatContract.imageOf(catIdx, false);

      setPunkSVG(punk);
      setCatSVG(cat);
    } catch (error) {
      console.error("Error fetching SVGs:", error);
      setErrorMsg(error.message || "Failed to fetch SVGs.");
      setPunkSVG(null);
      setCatSVG(null);
    }
    setLoading(false);
  }, [connected, debouncedPunkId, debouncedCatId]);

  // Only fetch when wallet connected & IDs change
  useEffect(() => {
    fetchAndCompose();
  }, [fetchAndCompose]);

  // Handle account change in wallet
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts) => {
      if (accounts.length === 0) {
        setAddress(null);
        setConnected(false);
      } else {
        setAddress(accounts[0]);
        setConnected(true);
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum.removeListener("accountsChanged", handler);
  }, []);

  const handleCatMouseDown = (e) => {
    e.preventDefault();
    const svg = document.getElementById("mooncat-svg-canvas"); // This is crucial
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const start = pt.matrixTransform(svg.getScreenCTM().inverse());

    const startCat = { x: catX, y: catY };

    const handleMove = (e2) => {
      const pt2 = svg.createSVGPoint();
      pt2.x = e2.clientX;
      pt2.y = e2.clientY;
      const curr = pt2.matrixTransform(svg.getScreenCTM().inverse());

      setCatX(startCat.x + (curr.x - start.x));
      setCatY(startCat.y + (curr.y - start.y));
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // Reset position/scale
  const handleReset = () => {
    setCatX(DEFAULT_CAT_X);
    setCatY(DEFAULT_CAT_Y);
    setCatScale(DEFAULT_CAT_SCALE);
  };

  return (
    <div className="mooncat-container">
      <h1 className="mooncat-title">MoonCat on Punk Composer</h1>
      <p className="mooncat-blurb">
        This tool reads CryptoPunks and MoonCats directly from Ethereum. Your
        wallet provides a free connection to access on-chain data without
        relying on external APIs.
        <br /><strong>This site will never ask for a transaction after connecting.</strong>
        <br />Use a throwaway wallet. Does not check your holdings
      </p>

      {!connected && (
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
      {connected && (
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
                    setCatId(Math.max(0, Math.min(25439, Number(e.target.value))))
                  }
                  className="mooncat-input"
                  disabled={loading}
                />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
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
            </div>
            <div className="mooncat-bg-controls">
  <label className="mooncat-label" style={{ marginBottom: 4 }}>Canvas Background</label>
  <div className="mooncat-bg-presets">
    <button type="button" onClick={() => setCanvasBg("#fff")} style={{ background: "#fff", color: "#222", border: canvasBg==='#fff' ? '2px solid #4f46e5':'1px solid #d1d5db' }}>White</button>
    <button type="button" onClick={() => setCanvasBg("#608191")} style={{ background: "#608191", color: "#fff", border: canvasBg==='#608191' ? '2px solid #4f46e5':'1px solid #d1d5db' }}>Blue</button>
    <button type="button" onClick={() => setCanvasBg("#181818")} style={{ background: "#181818", color: "#fff", border: canvasBg==='#181818' ? '2px solid #4f46e5':'1px solid #d1d5db' }}>Black</button>
    <button type="button" onClick={() => setCanvasBg("#a99dfe")} style={{ background: "#a99dfe", color: "#fff", border: canvasBg==="#a99dfe" ? '2px solid #4f46e5':'1px solid #d1d5db' }}>Purple</button>
    <input
      type="color"
      value={canvasBg}
      onChange={e => setCanvasBg(e.target.value)}
      style={{ marginLeft: 12, border: 'none', background: 'none', width: 36, height: 32, verticalAlign: 'middle' }}
      title="Custom"
    />
  </div>
</div>

            <button
              className="mooncat-reset-btn"
              onClick={handleReset}
              disabled={loading}
              style={{ marginTop: 10 }}
            >
              Reset Cat Position
            </button>
            <div
              style={{
                fontSize: "0.95rem",
                color: "#6b7280",
                margin: "8px 0 0 0",
              }}
            >
              Cat X: {catX} | Cat Y: {catY} | Scale: {catScale}
              <br />Drag the cat for placement
            </div>
          </div>
          <div className="mooncat-canvas-wrapper" >
            {punkSVG && catSVG && (
              <svg
                id="mooncat-svg-canvas"
                width={SVG_WIDTH}
                height={SVG_HEIGHT}
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT + 100}`}
                style={{ border: "1px solid #eee", background: canvasBg }}
              >
                {/* Punk SVG, perfectly centered */}
                <g dangerouslySetInnerHTML={{ __html: punkSVG }} />
                {/* Draggable MoonCat */}
                <g
                  transform={`translate(${catX},${catY}) scale(${catScale})`}
                  style={{ cursor: "grab" }}
                  onMouseDown={handleCatMouseDown}
                  dangerouslySetInnerHTML={{ __html: catSVG }}
                />
              </svg>
            )}
            {loading && <div className="mooncat-loading">Loading...</div>}
          </div>
        </>
      )}
    </div>
  );
}
