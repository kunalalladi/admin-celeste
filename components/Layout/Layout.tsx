import React, { useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Nprogress from "nprogress";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Navigation from "../Navigation";
import { MenuContextProvider } from "../../context/MenuContext";

const adminAccessRoutes = ["/admin", "/admin/products", "/admin/categories", "/admin/users", "/admin/orders"];

const Layout: React.FC = ({ children }) => {
  const router = useRouter();

  useEffect(() => {
    const startLoader = () => Nprogress.start();
    const stopLoader = () => Nprogress.done();

    router.events.on("routeChangeStart", startLoader);
    router.events.on("routeChangeComplete", stopLoader);
    router.events.on("routeChangeError", stopLoader);

    return () => {
      router.events.off("routeChangeStart", startLoader);
      router.events.off("routeChangeComplete", stopLoader);
      router.events.off("routeChangeError", stopLoader);
    };
  }, [router.events]);

  return (
    <MenuContextProvider>
      <Head>
        <title>Celeste</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"></meta>
      </Head>
      <div className="flex flex-row w-full h-full">
        {adminAccessRoutes.includes(router.pathname) && <Navigation />}
        {children}
        <ToastContainer />
      </div>
    </MenuContextProvider>
  );
};

export default Layout;
