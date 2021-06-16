export const obj_response = ({status_code = 200, status = "success", message = '', count = null, nextRequest = null, data = null }) => {
  return {
    status_code,
    response: {
      status,
      message,
      count,
      nextRequest,
      data,
    }
  };
};
