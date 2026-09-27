import React from 'react';
import ReactDOM from 'react-dom/client';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import App from './App.jsx';
import './index.css';
import './styles.css';

// Deliberately keep the root out of React.StrictMode here. Cesium owns an
// imperative WebGL viewer and starts an async Google 3D Tiles request during
// mount; StrictMode's development-only mount/unmount/remount cycle can start a
// second fetch before the first has settled.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
