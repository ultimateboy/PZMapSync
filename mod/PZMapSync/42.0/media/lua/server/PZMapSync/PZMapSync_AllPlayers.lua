require "PZMapSync/PZMapSync_Config"

PZMapSync = PZMapSync or {}

local AllPlayers = {
    lastBroadcastAt = 0,
    sequence = 0,
    loggedStart = false
}

local function log(message)
    print(PZMapSync.Config.LogPrefix .. " " .. message)
end

local function versionLabel()
    return tostring(PZMapSync.Config.ModVersion or "unknown") .. " (" .. tostring(PZMapSync.Config.Build or "unknown") .. ")"
end

local function nowMs()
    if getTimestampMs then
        local ok, value = pcall(getTimestampMs)
        if ok and value then
            return tonumber(value)
        end
    end

    return os.time() * 1000
end

local function callValue(target, methodName)
    if not target or not target[methodName] then
        return nil
    end

    local ok, value = pcall(function()
        return target[methodName](target)
    end)

    if ok then
        return value
    end

    return nil
end

local function nameOf(player)
    local username = callValue(player, "getUsername")
    if username and username ~= "" then
        return tostring(username)
    end

    local displayName = callValue(player, "getDisplayName")
    if displayName and displayName ~= "" then
        return tostring(displayName)
    end

    return "Player"
end

local function directionOf(player)
    local direction = callValue(player, "getDir")
    if direction ~= nil then
        return tostring(direction)
    end

    return nil
end

local function playerId(player)
    local username = callValue(player, "getUsername")
    if username and username ~= "" then
        return "remote-" .. tostring(username)
    end

    local onlineID = callValue(player, "getOnlineID")
    if onlineID ~= nil then
        return "remote-" .. tostring(onlineID)
    end

    return nil
end

local function buildPlayer(player, index)
    local username = callValue(player, "getUsername")

    return {
        id = playerId(player) or "remote-index-" .. tostring(index),
        name = nameOf(player),
        username = username and tostring(username) or nil,
        x = callValue(player, "getX"),
        y = callValue(player, "getY"),
        z = callValue(player, "getZ"),
        direction = directionOf(player)
    }
end

local function getOnlinePlayerObjects()
    local playerObjects = {}

    if not getOnlinePlayers then
        return playerObjects
    end

    local ok, onlinePlayers = pcall(getOnlinePlayers)
    if not ok or not onlinePlayers or not onlinePlayers.size or not onlinePlayers.get then
        return playerObjects
    end

    local okCount, count = pcall(function()
        return onlinePlayers:size()
    end)
    count = okCount and tonumber(count) or 0

    for index = 0, count - 1 do
        local okPlayer, player = pcall(function()
            return onlinePlayers:get(index)
        end)

        if okPlayer and player then
            playerObjects[#playerObjects + 1] = player
        end
    end

    return playerObjects
end

local function getPlayers(playerObjects)
    local players = {}

    for index, player in ipairs(playerObjects) do
        players[#players + 1] = buildPlayer(player, index)
    end

    return players
end

local canReceiveAllPlayers

local function getRecipients(playerObjects)
    local recipients = {}

    for _, player in ipairs(playerObjects) do
        if canReceiveAllPlayers(player) then
            recipients[#recipients + 1] = player
        end
    end

    return recipients
end

local function sandboxOption(name, defaultValue)
    if SandboxVars and SandboxVars.PZMapSync and SandboxVars.PZMapSync[name] ~= nil then
        return SandboxVars.PZMapSync[name]
    end

    return defaultValue
end

local function isAdmin(player)
    local accessLevel = callValue(player, "getAccessLevel")
    if not accessLevel then
        return false
    end

    accessLevel = string.lower(tostring(accessLevel))
    return accessLevel == "admin" or accessLevel == "moderator" or accessLevel == "overseer"
end

canReceiveAllPlayers = function(player)
    if sandboxOption("EnableAllPlayersBroadcast", false) == true then
        return true
    end

    return sandboxOption("EnableAdminAllPlayersBroadcast", true) == true and isAdmin(player)
end

local function allPlayersIntervalMs()
    if SandboxVars and SandboxVars.PZMapSync then
        local seconds = tonumber(SandboxVars.PZMapSync.AllPlayersBroadcastIntervalSeconds)
        if seconds and seconds > 0 then
            return seconds * 1000
        end
    end

    return PZMapSync.Config.AllPlayersIntervalMs
end

function AllPlayers.broadcast()
    local timestampMs = nowMs()
    if timestampMs - AllPlayers.lastBroadcastAt < allPlayersIntervalMs() then
        return
    end

    AllPlayers.lastBroadcastAt = timestampMs
    AllPlayers.sequence = AllPlayers.sequence + 1

    local playerObjects = getOnlinePlayerObjects()
    local recipients = getRecipients(playerObjects)
    if #recipients == 0 then
        return
    end

    if not AllPlayers.loggedStart then
        AllPlayers.loggedStart = true
        log("Version " .. versionLabel() .. " broadcasting all-player positions every " .. tostring(allPlayersIntervalMs() / 1000) .. "s")
    end

    local payload = {
        sequence = AllPlayers.sequence,
        writtenAt = timestampMs,
        players = getPlayers(playerObjects)
    }

    for _, player in ipairs(recipients) do
        sendServerCommand(player, PZMapSync.Config.ModId, "allPlayers", payload)
    end
end

Events.OnTick.Add(AllPlayers.broadcast)

PZMapSync.AllPlayers = AllPlayers
