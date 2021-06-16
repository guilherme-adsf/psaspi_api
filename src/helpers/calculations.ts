const base_sequence_calculation = ({
  freq,
  averageLikes,
  averageRetweets,
  averageRetweetsWithComments,
  averageComments,
}) => {
  const result = (
    freq *
    (averageLikes +
      averageRetweets +
      averageRetweetsWithComments +
      averageComments)
  ).toFixed(2);

  console.log(
    `Cálculo Capacidade Mob. Efetiva (frequencia[${freq}] * (mediaL[${averageLikes}] + mediaRt[${averageRetweets}] + mediaRtk[${averageRetweetsWithComments}] + mediaK[${averageComments}])): ${result}`
  );

  return result;
};

const base_indication_sequence_calculation = ({
  positiveOcurrency,
  averageLikes,
  averageRetweets,
  averageRetweetsWithComments,
  averageComments,
}) => {
  const result = (
    positiveOcurrency *
    (averageLikes +
      averageRetweets +
      averageRetweetsWithComments +
      averageComments)
  ).toFixed(2);

  console.log(
    `Cálculo Indicador Mob. Efetiva (ocorrenciaAcoes[${positiveOcurrency}] * (mediaL[${averageLikes}] + mediaRt[${averageRetweets}] + mediaRtk[${averageRetweetsWithComments}] + mediaK[${averageComments}])): ${result}`
  );
  console.log("\n");

  return result;
};

export const calculation_mobilization_capacity = ({
  freq,
  averageLikes,
  averageRetweets,
  averageRetweetsWithComments,
  averageComments,
}) => {
  const response = base_sequence_calculation({
    freq,
    averageLikes,
    averageRetweets,
    averageRetweetsWithComments,
    averageComments,
  });
  return Number(response);
};

export const calculation_indication_mobilization_capacity = ({
  sequence,
  averageLikes,
  averageRetweets,
  averageRetweetsWithComments,
  averageComments,
}) => {
  const split = sequence.split(" ");
  const filter = split.filter((item) => !item.includes("!"));
  const result = filter.length === 0 ? 1 : filter.length;
  const response = base_indication_sequence_calculation({
    positiveOcurrency: result,
    averageLikes,
    averageRetweets,
    averageRetweetsWithComments,
    averageComments,
  });
  return Number(response);
};
