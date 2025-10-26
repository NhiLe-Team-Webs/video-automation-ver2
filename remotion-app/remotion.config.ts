import {Config} from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setOverwriteOutput(true);
Config.setAudioCodec("aac");
Config.setAudioBitrate("128k");
Config.setPublicDir("./public");
Config.setMaxTimelineTracks(500);
