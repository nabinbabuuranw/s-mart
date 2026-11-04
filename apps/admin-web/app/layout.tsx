import './globals.css';
import type {Metadata} from 'next';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';
export const metadata:Metadata={title:'S Mart Admin',description:'S Mart administration console',robots:{index:false,follow:false}};
export default function Root({children}:{children:React.ReactNode}){
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{if(localStorage.getItem('sm-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}"}}/></head>
  <body><AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider></body></html>;
}
