export default {
  root: "./",
  server: {
    port: 5173,
    // proxy: {
    //   "/points": {
    //     target: "http://localhost:5000",
    //     changeOrigin: true,
    //     secure: false
    //   },
    //   "/config": {
    //     target: "http://localhost:5000",
    //     changeOrigin: true, 
    //     secure: false
    //   },
    //   "/bboxes": {
    //     target: "http://localhost:5000",
    //     changeOrigin: true, 
    //     secure: false
    //   }
    // }
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false
      }
    }
  }
}
