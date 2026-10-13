import { useEffect, useState } from "react";

export function useCodeApp(): [boolean] {
  const [isCodeApp, setIsCodeApp] = useState<boolean>(false);
  
    useEffect(() => {
      setIsCodeApp(window !== window.top);
    }, []);
  
    return [isCodeApp];
}
