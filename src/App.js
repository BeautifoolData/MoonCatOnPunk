import { useState, useEffect } from "react";
import { JsonRpcProvider, Contract, BrowserProvider } from "ethers";
import "./App.css";

const INFURA_URL = "https://mainnet.infura.io/v3/a94316d3aff1412d92fe781baee26a67"; // I don't know how to secure this. Don't be a jerk

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
  const [providerReady, setProviderReady] = useState(false);

  const [mode5997, setMode5997] = useState(false);

  // Wallet state
  const [connected, setConnected] = useState(false);

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

  const [punkX, setPunkX] = useState(0);
  const [punkY, setPunkY] = useState(0);
  const [punkScale, setPunkScale] = useState(1);

  // Loading/error
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

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
      console.log("window.ethereum");
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

  const handlePunkMouseDown = (e) => {
    e.preventDefault();
    const svg = document.getElementById("mooncat-svg-canvas");
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const start = pt.matrixTransform(svg.getScreenCTM().inverse());

    const startPunk = { x: punkX, y: punkY };

    const handleMove = (e2) => {
      const pt2 = svg.createSVGPoint();
      pt2.x = e2.clientX;
      pt2.y = e2.clientY;
      const curr = pt2.matrixTransform(svg.getScreenCTM().inverse());

      setPunkX(startPunk.x + (curr.x - start.x));
      setPunkY(startPunk.y + (curr.y - start.y));
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
                    setCatId(
                      Math.max(0, Math.min(25439, Number(e.target.value))),
                    )
                  }
                  className="mooncat-input"
                  disabled={loading}
                />
              </div>
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
            <button
              className={`mooncat-mode-btn${mode5997 ? " active" : ""}`}
              onClick={handleModeToggle}
              type="button"
              style={{ marginBottom: 12 }}
            >
              5997 Mode 🐱
            </button>
          </div>
          {loading && <div className="mooncat-loading">Loading...</div>}
          <div className="mooncat-canvas-wrapper">
            {punkSVG && catSVG && (
              <svg
                id="mooncat-svg-canvas"
                width={SVG_WIDTH}
                height={SVG_HEIGHT}
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT + 200}`}
                style={{ border: "1px solid #eee", background: canvasBg }}
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
                      style={{ cursor: "grab" }}
                      onMouseDown={handlePunkMouseDown}
                      dangerouslySetInnerHTML={{ __html: punkSVG }}
                    />
                  </>
                ) : (
                  <>
                    {/* Punk is static, Cat is draggable & scalable */}
                    <g dangerouslySetInnerHTML={{ __html: punkSVG }} />
                    <g
                      transform={`translate(${catX},${catY}) scale(${catScale})`}
                      style={{ cursor: "grab" }}
                      onMouseDown={handleCatMouseDown}
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
