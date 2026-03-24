// vite.config.ts
import { defineConfig } from "file:///C:/Users/victo/.gemini/antigravity/scratch/warehouse-visual-map/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/victo/.gemini/antigravity/scratch/warehouse-visual-map/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/victo/.gemini/antigravity/scratch/warehouse-visual-map/node_modules/vite-plugin-pwa/dist/index.js";
import { viteObfuscateFile } from "file:///C:/Users/victo/.gemini/antigravity/scratch/warehouse-visual-map/node_modules/vite-plugin-obfuscator/index.js";
var vite_config_default = defineConfig(({ command }) => ({
  base: command === "serve" ? "/" : "/AlmacenEventos/",
  plugins: [
    react(),
    viteObfuscateFile({
      include: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js", "src/**/*.jsx"],
      exclude: [/node_modules/],
      apply: "build",
      options: {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        numbersToExpressions: true,
        simplify: true,
        stringArrayShuffle: true,
        splitStrings: true,
        stringArrayThreshold: 0.75
      }
    }),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 8e6
        // 8 MB
      },
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "SGA Eventos",
        short_name: "Almac\xE9n",
        description: "Gesti\xF3n Visual de Almac\xE9n",
        display: "standalone",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5200,
    strictPort: true,
    // Force fail if 5200 is taken, to avoid confusion
    cors: true,
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false
      }
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx2aWN0b1xcXFwuZ2VtaW5pXFxcXGFudGlncmF2aXR5XFxcXHNjcmF0Y2hcXFxcd2FyZWhvdXNlLXZpc3VhbC1tYXBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXHZpY3RvXFxcXC5nZW1pbmlcXFxcYW50aWdyYXZpdHlcXFxcc2NyYXRjaFxcXFx3YXJlaG91c2UtdmlzdWFsLW1hcFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvdmljdG8vLmdlbWluaS9hbnRpZ3Jhdml0eS9zY3JhdGNoL3dhcmVob3VzZS12aXN1YWwtbWFwL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5pbXBvcnQgeyB2aXRlT2JmdXNjYXRlRmlsZSB9IGZyb20gJ3ZpdGUtcGx1Z2luLW9iZnVzY2F0b3InXG5cbi8vIGh0dHBzOi8vdml0ZS5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IGNvbW1hbmQgfSkgPT4gKHtcbiAgYmFzZTogY29tbWFuZCA9PT0gJ3NlcnZlJyA/ICcvJyA6ICcvQWxtYWNlbkV2ZW50b3MvJyxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgdml0ZU9iZnVzY2F0ZUZpbGUoe1xuICAgICAgaW5jbHVkZTogWydzcmMvKiovKi50cycsICdzcmMvKiovKi50c3gnLCAnc3JjLyoqLyouanMnLCAnc3JjLyoqLyouanN4J10sXG4gICAgICBleGNsdWRlOiBbL25vZGVfbW9kdWxlcy9dLFxuICAgICAgYXBwbHk6ICdidWlsZCcsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGNvbXBhY3Q6IHRydWUsXG4gICAgICAgIGNvbnRyb2xGbG93RmxhdHRlbmluZzogdHJ1ZSxcbiAgICAgICAgY29udHJvbEZsb3dGbGF0dGVuaW5nVGhyZXNob2xkOiAwLjc1LFxuICAgICAgICBudW1iZXJzVG9FeHByZXNzaW9uczogdHJ1ZSxcbiAgICAgICAgc2ltcGxpZnk6IHRydWUsXG4gICAgICAgIHN0cmluZ0FycmF5U2h1ZmZsZTogdHJ1ZSxcbiAgICAgICAgc3BsaXRTdHJpbmdzOiB0cnVlLFxuICAgICAgICBzdHJpbmdBcnJheVRocmVzaG9sZDogMC43NVxuICAgICAgfVxuICAgIH0pLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICB3b3JrYm94OiB7XG4gICAgICAgIHNraXBXYWl0aW5nOiB0cnVlLFxuICAgICAgICBjbGllbnRzQ2xhaW06IHRydWUsXG4gICAgICAgIGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcbiAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDgwMDAwMDAgLy8gOCBNQlxuICAgICAgfSxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnbWFza2VkLWljb24uc3ZnJ10sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnU0dBIEV2ZW50b3MnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnQWxtYWNcdTAwRTluJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdHZXN0aVx1MDBGM24gVmlzdWFsIGRlIEFsbWFjXHUwMEU5bicsXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjZmZmZmZmJyxcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICdwd2EtMTkyeDE5Mi5wbmcnLFxuICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgICAgcHVycG9zZTogJ2FueSBtYXNrYWJsZSdcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIH0pXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IHRydWUsXG4gICAgcG9ydDogNTIwMCxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLCAvLyBGb3JjZSBmYWlsIGlmIDUyMDAgaXMgdGFrZW4sIHRvIGF2b2lkIGNvbmZ1c2lvblxuICAgIGNvcnM6IHRydWUsXG4gICAgaGVhZGVyczoge1xuICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJ1xuICAgIH0sXG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjgwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9XG4gICAgfVxuICB9LFxufSkpXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTZYLFNBQVMsb0JBQW9CO0FBQzFaLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsU0FBUyx5QkFBeUI7QUFHbEMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxRQUFRLE9BQU87QUFBQSxFQUM1QyxNQUFNLFlBQVksVUFBVSxNQUFNO0FBQUEsRUFDbEMsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sa0JBQWtCO0FBQUEsTUFDaEIsU0FBUyxDQUFDLGVBQWUsZ0JBQWdCLGVBQWUsY0FBYztBQUFBLE1BQ3RFLFNBQVMsQ0FBQyxjQUFjO0FBQUEsTUFDeEIsT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLFFBQ1AsU0FBUztBQUFBLFFBQ1QsdUJBQXVCO0FBQUEsUUFDdkIsZ0NBQWdDO0FBQUEsUUFDaEMsc0JBQXNCO0FBQUEsUUFDdEIsVUFBVTtBQUFBLFFBQ1Ysb0JBQW9CO0FBQUEsUUFDcEIsY0FBYztBQUFBLFFBQ2Qsc0JBQXNCO0FBQUEsTUFDeEI7QUFBQSxJQUNGLENBQUM7QUFBQSxJQUNELFFBQVE7QUFBQSxNQUNOLGNBQWM7QUFBQSxNQUNkLFNBQVM7QUFBQSxRQUNQLGFBQWE7QUFBQSxRQUNiLGNBQWM7QUFBQSxRQUNkLHVCQUF1QjtBQUFBLFFBQ3ZCLCtCQUErQjtBQUFBO0FBQUEsTUFDakM7QUFBQSxNQUNBLGVBQWUsQ0FBQyxlQUFlLHdCQUF3QixpQkFBaUI7QUFBQSxNQUN4RSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsUUFDYixPQUFPO0FBQUEsVUFDTDtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxVQUNBO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDWDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBO0FBQUEsSUFDWixNQUFNO0FBQUEsSUFDTixTQUFTO0FBQUEsTUFDUCwrQkFBK0I7QUFBQSxJQUNqQztBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
