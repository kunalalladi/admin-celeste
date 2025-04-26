import React, { useState } from "react";
import Image from "next/image";
import { useForm, Controller } from "react-hook-form";
import { useRouter } from "next/router";

import { Input, MessageI } from "../../components/Form";
import Button from "../../components/Button";

import loginStyles from "../../styles/Login.module.css";
import { appFetch } from "../../utils/api";
import { showToast } from "../../utils/feUtils";
import { NContext } from "../../utils/types";

interface Credential {
  email: string;
  password: string;
}

const Login = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const {
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<Credential>();

  const onSubmit = async (data: Credential) => {
    setIsLoading(true);
    const response = await appFetch("signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...data, isAdmin: true }),
    });

    setIsLoading(false);

    if (response?.status == 200) {
      showToast(response.message, "success");
      router.push("/admin");
    }

    if (response?.errors?.length) {
      response.errors.map((error: { key: keyof Credential; message: string }) => setError(error.key, { message: error.message }));
    }
  };

  return (
    <div className="flex flex-row w-full h-full">
      <div className={`basis-3/5 ${loginStyles.loginBg} hidden lg:block`}></div>
      <div className="lg:basis-2/5 w-full flex flex-col justify-center items-center">
        <Image
          src={"https://ik.imagekit.io/miiw4kn7b/logo_v2.png?updatedAt=1740557787106"}
          width={260}
          height={120}
          alt="Celeste Logo"
        />
        <form onSubmit={handleSubmit(onSubmit)} className="sm:w-7/12 w-10/12 mx-auto mt-16">
          <Controller
            name="email"
            control={control}
            defaultValue=""
            rules={{ required: "Please enter email address." }}
            render={({ field }) => {
              const additionalInputProps = {} as MessageI;

              if (errors.email?.message) {
                additionalInputProps.messageType = "error";
                additionalInputProps.message = errors.email.message;
              }

              return <Input type="email" label="Email" {...field} {...additionalInputProps} />;
            }}
          />
          <Controller
            name="password"
            control={control}
            defaultValue=""
            rules={{ required: "Please enter password." }}
            render={({ field }) => {
              const additionalInputProps = {} as MessageI;

              if (errors.password?.message) {
                additionalInputProps.messageType = "error";
                additionalInputProps.message = errors.password.message;
              }

              return <Input type="password" label="Password" {...field} {...additionalInputProps} />;
            }}
          />

          <Button type="submit" variant="primary" isLoading={isLoading} className="mt-2">
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};

Login.getInitialProps = async (ctx: NContext) => {
  const cookies = ctx.req?.cookies || {};

  if (cookies?.token && ctx.res) {
    ctx.res.setHeader("Cache-Control", "no-store");
    ctx.res.writeHead(301, {
      Location: "/admin/",
    });
    ctx.res.end();
  }

  return { props: {} };
};

export default Login;