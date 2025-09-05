import { DataPreloader } from "@/services/dataPreloader";

// Force clear all caches and restart preloading
console.log('🔄 Force clearing all caches...');
DataPreloader.clearCache();

// Wait a moment then restart preloading
setTimeout(() => {
  console.log('🚀 Restarting data preload with fresh cache...');
  DataPreloader.preloadDefaultData().then(() => {
    console.log('✅ Fresh data preload completed');
  }).catch(error => {
    console.error('❌ Error in fresh preload:', error);
  });
}, 100);

export {};