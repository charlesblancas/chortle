import { fastChessReply } from "./fastChessEngine.js";

self.onmessage = ({ data }) => self.postMessage(fastChessReply(data));
