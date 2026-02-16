import { useEffect } from 'react';
import WindowLayout from "./components/WindowLayout";

export default function App() {
  // Лог для перевірки доступності window.api
  useEffect(() => {
    console.log('window.api:', window.api);  // Дивись на лог в DevTools
  }, []);

  return <WindowLayout />;
}