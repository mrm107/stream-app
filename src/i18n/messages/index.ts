// Every message namespace. Keys are "<namespace>.<key>", e.g. t("chat.send").
import auth from "./auth";
import browse from "./browse";
import chat from "./chat";
import common from "./common";
import errors from "./errors";
import nav from "./nav";
import player from "./player";
import profile from "./profile";
import studio from "./studio";
import watch from "./watch";

export const namespaces = { auth, browse, chat, common, errors, nav, player, profile, studio, watch };
