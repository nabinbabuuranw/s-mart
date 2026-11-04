'use client';
import React,{createContext,useContext,useEffect,useState,useCallback} from 'react';
import { hasPermission } from '@smart/shared';
import { api } from './api';
type U={id:string;email:string;name:string;role:string;permissions:string[]};
const Ctx=createContext<any>(null);
export function AuthProvider({children}:any){
  const [user,setUser]=useState<U|null>(null);const [ready,setReady]=useState(false);
  const load=useCallback(async()=>{try{setUser(await api('/admin/me'))}catch{setUser(null)}setReady(true)},[]);
  useEffect(()=>{load()},[load]);
  const login=async(email:string,password:string)=>{await api('/auth/login',{method:'POST',body:{email,password,audience:'admin'}});await load();};
  const logout=async()=>{try{await api('/auth/logout',{method:'POST'})}catch{};setUser(null);location.href='/login';};
  const can=(p:string|string[])=>!!user&&(Array.isArray(p)?p.some(x=>hasPermission(user.permissions,x)):hasPermission(user.permissions,p));
  return <Ctx.Provider value={{user,ready,login,logout,can}}>{children}</Ctx.Provider>;
}
export const useAuth=()=>useContext(Ctx);
