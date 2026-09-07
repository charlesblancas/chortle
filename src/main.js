import './app.css'
import '../node_modules/chessground/assets/chessground.cburnett.css'
import App from './App.svelte'
import { mount } from 'svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
