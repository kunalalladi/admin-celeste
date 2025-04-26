import { showToast } from "./feUtils";
import { FetchConfig } from "./types";

export const DEV_URL = "/api/";
export const appFetch = async (url: string, options: FetchConfig) => {
  try {
    const endpoint = options.disableUrlAppend ? url : `${DEV_URL}${url}`;

    if (options.isFormData) {
      const data = { ...options.body };
      const formData = new FormData();

      for (const key in data) {
        if (key === "image" && data?.image?.length) {
          data.image.map((image: any) => formData.append("image", image));
        } else {
          formData.append(key, data[key]);
        }
      }

      options.body = formData;
    }

    if ("isFormData" in options) {
      delete options.isFormData;
    }

    const response = await fetch(endpoint, { ...options });
    
    // Check if response is okay before trying to parse JSON
    if (!response.ok) {
      // Handle non-200 responses
      return handleAPIError(response, endpoint);
    }
    
    // Check if the content type is JSON before parsing
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    } else {
      throw new Error(`Expected JSON response but got ${contentType}`);
    }
  } catch (err) {
    console.error("❌ Fetch Error:", err);
    showToast("Something went wrong.", "error");
    return { error: true, message: err.message };
  }
};

async function handleAPIError(response: any, endpoint: string) {
  try {
    // Check if response can be parsed as JSON
    const contentType = response.headers.get("content-type");
    let data;
    
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      // If not JSON, get text content for debugging
      const text = await response.text();
      console.error("Non-JSON response:", text.substring(0, 200) + "...");
      return { status: response.status, message: "Server returned non-JSON response" };
    }
    
    if (data.status === "403" && data.redirect) {
      await appFetch("signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      showToast("Session expired.", "error");
      window.location.href = "/admin";
    } else if (data.message && !data.errors?.length) {
      showToast(data.message, "error");
    }
    
    return data;
  } catch (err) {
    console.error("❌ Error handling API response:", err);
    showToast("Error processing server response", "error");
    return { error: true, message: "Error processing server response" };
  }
}