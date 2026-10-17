import { getState, setState, subscribe } from './src/js/state.js';

subscribe((state) => console.log('state changed:', state));
console.log('initial state:', getState());

