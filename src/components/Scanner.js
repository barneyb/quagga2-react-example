import Quagga from '@ericblade/quagga2';
import PropTypes from 'prop-types';
import React, {
    useCallback,
    useLayoutEffect,
} from 'react';

function getMedian(arr) {
    arr.sort((a, b) => a - b);
    const half = Math.floor(arr.length / 2);
    if (arr.length % 2 === 1) {
        return arr[half];
    }
    return (arr[half - 1] + arr[half]) / 2;
}

function getMedianOfCodeErrors(decodedCodes) {
    const errors = decodedCodes.filter(x => x.error !== undefined).map(x => x.error);
    const medianOfErrors = getMedian(errors);
    return medianOfErrors;
}

const defaultConstraints = {
    width: 640,
    height: 480,
};

const defaultLocatorSettings = {
    patchSize: 'medium',
    halfSample: true,
};

const defaultDecoders = ['ean_reader'];

const Scanner = ({
    onDetected,
    scannerRef,
    onProcessed,
    onScannerReady,
    cameraId,
    facingMode,
    constraints = defaultConstraints,
    locator = defaultLocatorSettings,
    numOfWorkers = navigator.hardwareConcurrency || 0,
    decoders = defaultDecoders,
    locate = true,
}) => {
    const errorCheck = useCallback((result) => {
        if (!onDetected) {
            return;
        }
        const err = getMedianOfCodeErrors(result.codeResult.decodedCodes);
        onDetected(result.codeResult.code, err);
    }, [onDetected]);

    const handleProcessed = (result) => {
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;
        // drawingCtx.font = "24px Arial";
        // drawingCtx.fillStyle = 'green';

        if (result) {
            onProcessed && onProcessed(result);
            // console.warn('* quagga onProcessed', result);
            if (result.boxes) {
                drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute('width')), parseInt(drawingCanvas.getAttribute('height')));
                result.boxes.filter((box) => box !== result.box).forEach((box) => {
                    Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: 'purple', lineWidth: 2 });
                });
            }
            if (result.box) {
                Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: 'blue', lineWidth: 2 });
            }
            // if (result.codeResult && result.codeResult.code) {
            //     const code = result.codeResult.code;
            //     const validated = validate(code, "upc").valid;
            //     // const validated = barcodeValidator(result.codeResult.code);
            //     // const validated = validateBarcode(result.codeResult.code);
            //     Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: validated ? 'green' : 'red', lineWidth: 3 });
            //     drawingCtx.font = "24px Arial";
            //     // drawingCtx.fillStyle = validated ? 'green' : 'red';
            //     // drawingCtx.fillText(`${result.codeResult.code} valid: ${validated}`, 10, 50);
            //     drawingCtx.fillText(code, 10, 20);
            //     // if (validated) {
            //     //     onDetected(result);
            //     // }
            // }
        }
    };

    useLayoutEffect(() => {
        Quagga.init({
            inputStream: {
                type: 'LiveStream',
                constraints: {
                    ...constraints,
                    ...(cameraId && { deviceId: cameraId }),
                    ...(!cameraId && { facingMode }),
                },
                area: { // defines rectangle of the detection/localization area
                    top: "10%",
                    right: "15%",
                    left: "15%",
                    bottom: "10%",
                },
                target: scannerRef.current,
            },
            locator,
            numOfWorkers,
            decoder: { readers: decoders },
            locate,
        }, (err) => {
            // Quagga.onProcessed(handleProcessed);

            if (err) {
                return console.log('Error starting Quagga:', err);
            }
            if (scannerRef && scannerRef.current) {
                Quagga.start();
                if (onScannerReady) {
                    onScannerReady();
                }
            }
        });
        Quagga.onDetected(errorCheck);
        return () => {
            Quagga.offDetected(errorCheck);
            Quagga.offProcessed(handleProcessed);
            Quagga.stop();
        };
    }, [cameraId, onScannerReady, scannerRef.current, errorCheck, constraints, locator, decoders, locate]);
    return null;
}

Scanner.propTypes = {
    onDetected: PropTypes.func.isRequired,
    scannerRef: PropTypes.object.isRequired,
    onScannerReady: PropTypes.func,
    cameraId: PropTypes.string,
    facingMode: PropTypes.string,
    constraints: PropTypes.object,
    locator: PropTypes.object,
    numOfWorkers: PropTypes.number,
    decoders: PropTypes.array,
    locate: PropTypes.bool,
};

export default Scanner;
