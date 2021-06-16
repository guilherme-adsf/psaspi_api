export const format_number_pt_br = (value) => {
  let format_number = new Intl.NumberFormat("pt-BR").format(value);

  let split = format_number.split(".");

  if (split.length === 1) {
    return split[0].replace(/,/g, ".");
  } else if (split.length === 2) {
    return split[0].replace(/,/g, ".") + "," + split[1];
  } else {
    return format_number;
  }
};
