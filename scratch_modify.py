import os
import re

def modify_file(filepath, replacements, is_context=False):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # If already modified, skip
    if 'getStorage()' in content:
        print(f"Already modified {filepath}")
        return

    if is_context:
        # Add isMobile and getStorage
        insert_code = """
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const getStorage = () => isMobile() ? localStorage : sessionStorage;
"""
        content = content.replace('const KYCContext = createContext(null);', f'const KYCContext = createContext(null);\n{insert_code}')
        
        # Add the 1-day expiration logic
        expire_logic = """
    if (typeof window !== "undefined" && isMobile()) {
      const sessionStart = localStorage.getItem("mobileSessionStart");
      const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
      if (sessionStart && (Date.now() - parseInt(sessionStart)) > ONE_DAY_IN_MS) {
        localStorage.clear();
      } else if (!sessionStart) {
        localStorage.setItem("mobileSessionStart", Date.now().toString());
      }
    }
"""
        content = content.replace('export function KYCProvider({ children }) {\n  const [state, setState] = useState(INITIAL_STATE);', f'export function KYCProvider({{ children }}) {{\n  const [state, setState] = useState(INITIAL_STATE);\n{expire_logic}')

    else:
        # For other files, we just add the helpers at the top if they use getStorage
        insert_code = """
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const getStorage = () => isMobile() ? localStorage : sessionStorage;
"""
        # Find first import or 'use client'
        if '"use client";' in content:
            content = content.replace('"use client";', f'"use client";\n{insert_code}')
        else:
            content = insert_code + "\n" + content

    for old, new in replacements:
        content = content.replace(old, new)
        
    # Extra fix for sessionStorage to getStorage() regex
    content = re.sub(r'\bsessionStorage\.(getItem|setItem|removeItem|clear)\b', r'getStorage().\1', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Successfully modified {filepath}")

modify_file('src/context/KYCContext.js', [], is_context=True)
modify_file('src/hooks/useLocalDraft.js', [])
modify_file('src/utils/kycApi.js', [])
