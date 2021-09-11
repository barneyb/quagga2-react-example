import validate from "@ericblade/barcode-validator";
import Quagga from "@ericblade/quagga2";
import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import Scanner from './Scanner';

function getStandardDeviation(array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
}

const constraints = {
    width: 640,
    height: 400,
}

const App = () => {
    const [scanning, setScanning] = useState(true);
    const [hist, setHist] = useState({});
    const [errors, setErrors] = useState({});
    const [stats, setStats] = useState([]);
    const [timing, setTiming] = useState([0, 0, null, null]);
    const [scanCount, setScanCount] = useState(0);
    const scannerRef = useRef(null);

    const handleResult = useCallback((code, err) => {
        let error = false;
        if (err > 0.25) {
            error = true;
        } else {
            const valRes = validate(code, "upc")
            code = valRes.modifiedCode;
            if (!valRes.valid) {
                error = true;
            }
        }
        setTiming(([rc, ec, start]) => {
            const now = Date.now();
            const st = start || now;
            return [rc + 1, error ? ec + 1 : ec, st, now - st];
        })
        if (error) {
            setErrors(h => ({
                ...h,
                [code]: (h[code] || 0) + 1,
            }))
        } else {
            setHist(h => ({
                ...h,
                [code]: (h[code] || 0) + 1,
            }));
        }
    }, [setHist, setErrors]);

    const handleScan = useCallback(result => setScanCount(n => n + 1))

    useEffect(() => {
        const codes = Object.keys(hist);
        if (codes.length === 0) {
            setStats([])
            return;
        }
        const counts = Object.values(hist)
        const stats = codes.map(code => ({
            code,
            count: hist[code],
            status: "waiting",
        }));
        if (counts.length === 1 && counts[0] >= 6) {
            setScanning(false);
            stats[0].status = "perfect"
        } else {
            const stddev = getStandardDeviation(counts);
            const max = Math.max(...counts);
            if (stddev > 1 && max >= 6) {
                const cutoff = max - 1.5 * stddev;
                const cluster = new Set([...codes.filter(c => hist[c] >= cutoff)]);
                if (cluster.size === 1) {
                    setScanning(false);
                }
                stats.forEach(s => {
                    s.status = cluster.has(s.code)
                        ? cluster.size === 1 ? "single" : "cluster"
                        : `garbage-${Math.floor((max - hist[s.code]) / stddev)}`
                })
            }
        }
        setStats(stats.sort((a, b) => {
            if (a.count !== b.count) return b.count - a.count;
            return a.code < b.code ? -1 : 1;
        }));
    }, [hist])

    // reset on start
    useEffect(() => {
        if (scanning) {
            setScanCount(0)
            setTiming([0, 0, null, null])
            setHist({})
            setErrors({})
        }
    }, [scanning])

    const handleScannerReady = useCallback(() => {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const { width, height } = constraints;
        drawingCtx.fillStyle = "#00000066";
        drawingCtx.fillRect(0, 0, width, height);
        const dx = width * 0.15;
        const dy = height * 0.1;
        drawingCtx.clearRect(dx, dy, width - 2 * dx, height - 2 * dy);
    }, [scannerRef.current]);

    return (
        <div>
            <button
                onClick={() => setScanning(s => !s)}>{scanning ? 'Stop' : 'Start'}</button>
            {stats.length} / {timing[0]} accepted
            {Object.keys(errors).length} / {timing[1]} invalid in {timing[3] / 1000} sec
            ({Math.round((timing[0] + timing[1] - 1) / timing[3] * 10000) / 10} detects / sec)
            ({Math.round((scanCount - 1) / timing[3] * 10000) / 10} scans / sec)
            <div ref={scannerRef}
                 style={{position: 'relative', border: '3px solid red', ...constraints}}>
                {/* <video style={{ width: window.innerWidth, height: 480, border: '3px solid orange' }}/> */}
                <canvas className="drawingBuffer" style={{
                    position: 'absolute',
                }} />
                {scanning ? <Scanner scannerRef={scannerRef}
                                     onDetected={handleResult}
                                     onScannerReady={handleScannerReady}
                                     onProcessed={handleScan}
                                     locate={false}
                                     constraints={constraints}
                /> : null}
            </div>
            <div style={{display: "flex", justifyContent: "space-between"}}>
                <ul className="results">
                    {stats.map(s =>
                        <li key={s.code}
                            className={s.status}
                        >
                            {s.code} : {s.count}
                        </li>)}
                </ul>
                <ul className="results">
                    {Object.keys(errors).map((c, i) =>
                        <li key={i}
                            className={"invalid"}
                        >
                            {c} : {errors[c]}
                        </li>)}
                </ul>
            </div>
        </div>
    );
};

export default App;
