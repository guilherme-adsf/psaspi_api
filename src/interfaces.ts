export interface IMaxValues {
  collect_id: number;
  sentiment?:
    | "positive"
    | "neutral"
    | "negative"
    | "não classificado"
    | undefined;
  column?: "likes" | "retweets" | "retweetsWithComments" | "comments";
  gspSequence?: string;
}

export interface IMaxValuesObj {
  maxLikes: number;
  maxRetweets: number;
  maxRetweetsWithComments: number;
  maxComments: number;
}

export interface IMaxValuesResponse {
  max_value_positive?: IMaxValuesObj;
  max_value_negative?: IMaxValuesObj;
  max_value_neutral?: IMaxValuesObj;
  max_value_nclass?: IMaxValuesObj;
  NL_NRt_NRtk_NK_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_K_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_NK_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_NK_max_value?: IMaxValuesObj;
  L_NRt_NRtk_NK_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_K_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_K_max_value?: IMaxValuesObj;
  L_NRt_NRtk_K_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_NK_max_value?: IMaxValuesObj;
  L_NRt_Rtk_NK_max_value?: IMaxValuesObj;
  L_Rt_NRtk_NK_max_value?: IMaxValuesObj;
  L_Rt_Rtk_NK_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_K_max_value?: IMaxValuesObj;
  L_Rt_NRtk_K_max_value?: IMaxValuesObj;
  L_NRt_Rtk_K_max_value?: IMaxValuesObj;
  L_Rt_Rtk_K_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_NK_positive_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_K_positive_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_NK_positive_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_NK_positive_max_value?: IMaxValuesObj;
  L_NRt_NRtk_NK_positive_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_K_positive_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_K_positive_max_value?: IMaxValuesObj;
  L_NRt_NRtk_K_positive_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_NK_positive_max_value?: IMaxValuesObj;
  L_NRt_Rtk_NK_positive_max_value?: IMaxValuesObj;
  L_Rt_NRtk_NK_positive_max_value?: IMaxValuesObj;
  L_Rt_Rtk_NK_positive_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_K_positive_max_value?: IMaxValuesObj;
  L_Rt_NRtk_K_positive_max_value?: IMaxValuesObj;
  L_NRt_Rtk_K_positive_max_value?: IMaxValuesObj;
  L_Rt_Rtk_K_positive_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_NK_neutral_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_K_neutral_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_NK_neutral_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_NK_neutral_max_value?: IMaxValuesObj;
  L_NRt_NRtk_NK_neutral_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_K_neutral_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_K_neutral_max_value?: IMaxValuesObj;
  L_NRt_NRtk_K_neutral_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_NK_neutral_max_value?: IMaxValuesObj;
  L_NRt_Rtk_NK_neutral_max_value?: IMaxValuesObj;
  L_Rt_NRtk_NK_neutral_max_value?: IMaxValuesObj;
  L_Rt_Rtk_NK_neutral_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_K_neutral_max_value?: IMaxValuesObj;
  L_Rt_NRtk_K_neutral_max_value?: IMaxValuesObj;
  L_NRt_Rtk_K_neutral_max_value?: IMaxValuesObj;
  L_Rt_Rtk_K_neutral_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_NK_negative_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_K_negative_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_NK_negative_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_NK_negative_max_value?: IMaxValuesObj;
  L_NRt_NRtk_NK_negative_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_K_negative_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_K_negative_max_value?: IMaxValuesObj;
  L_NRt_NRtk_K_negative_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_NK_negative_max_value?: IMaxValuesObj;
  L_NRt_Rtk_NK_negative_max_value?: IMaxValuesObj;
  L_Rt_NRtk_NK_negative_max_value?: IMaxValuesObj;
  L_Rt_Rtk_NK_negative_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_K_negative_max_value?: IMaxValuesObj;
  L_Rt_NRtk_K_negative_max_value?: IMaxValuesObj;
  L_NRt_Rtk_K_negative_max_value?: IMaxValuesObj;
  L_Rt_Rtk_K_negative_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_NK_nclass_max_value?: IMaxValuesObj;
  NL_NRt_NRtk_K_nclass_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_NK_nclass_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_NK_nclass_max_value?: IMaxValuesObj;
  L_NRt_NRtk_NK_nclass_max_value?: IMaxValuesObj;
  NL_NRt_Rtk_K_nclass_max_value?: IMaxValuesObj;
  NL_Rt_NRtk_K_nclass_max_value?: IMaxValuesObj;
  L_NRt_NRtk_K_nclass_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_NK_nclass_max_value?: IMaxValuesObj;
  L_NRt_Rtk_NK_nclass_max_value?: IMaxValuesObj;
  L_Rt_NRtk_NK_nclass_max_value?: IMaxValuesObj;
  L_Rt_Rtk_NK_nclass_max_value?: IMaxValuesObj;
  NL_Rt_Rtk_K_nclass_max_value?: IMaxValuesObj;
  L_Rt_NRtk_K_nclass_max_value?: IMaxValuesObj;
  L_NRt_Rtk_K_nclass_max_value?: IMaxValuesObj;
  L_Rt_Rtk_K_nclass_max_value?: IMaxValuesObj;
}
