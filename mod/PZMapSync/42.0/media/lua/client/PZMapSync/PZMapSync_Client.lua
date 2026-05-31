require "PZMapSync/PZMapSync_Config"
require "PZMapSync/PZMapSync_Writer"
require "PZMapSync/PZMapSync_MapMarkers"
require "PZMapSync/PZMapSync_RemotePlayers"

PZMapSync = PZMapSync or {}

local Client = {
    lastWriteAt = 0,
    sequence = 0,
    wroteFirstSnapshot = false
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

local function directionOf(player)
    local direction = callValue(player, "getDir")
    if direction ~= nil then
        return tostring(direction)
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

local function playerId(player, isLocal)
    if isLocal then
        return "local-0"
    end

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

local function saveName()
    if getWorld and getWorld() and getWorld().getWorld then
        local ok, value = pcall(function()
            return getWorld():getWorld()
        end)
        if ok and value then
            return tostring(value)
        end
    end

    if getGameTime and getGameTime() and getGameTime().getWorldAgeHours then
        local ok, value = pcall(function()
            return getGameTime():getWorldAgeHours()
        end)
        if ok and value then
            return "world-age-" .. tostring(math.floor(value))
        end
    end

    return nil
end

local function buildPlayer(player, isLocal)
    return {
        id = playerId(player, isLocal),
        name = nameOf(player),
        x = callValue(player, "getX"),
        y = callValue(player, "getY"),
        z = callValue(player, "getZ"),
        direction = directionOf(player),
        localPlayer = isLocal == true
    }
end

local function addPlayer(players, seenIds, player, isLocal)
    if not player then
        return
    end

    local entry = buildPlayer(player, isLocal)
    if not entry.id then
        entry.id = "player-" .. tostring(#players + 1)
    end

    if seenIds[entry.id] then
        return
    end

    seenIds[entry.id] = true
    players[#players + 1] = entry
end

local function buildPlayers(localPlayer)
    local players = {}
    local seenIds = {}
    local localUsername = callValue(localPlayer, "getUsername")

    addPlayer(players, seenIds, localPlayer, true)

    if getOnlinePlayers then
        local ok, onlinePlayers = pcall(getOnlinePlayers)
        if ok and onlinePlayers and onlinePlayers.size and onlinePlayers.get then
            local okCount, count = pcall(function()
                return onlinePlayers:size()
            end)
            count = okCount and tonumber(count) or 0

            for index = 0, count - 1 do
                local okPlayer, onlinePlayer = pcall(function()
                    return onlinePlayers:get(index)
                end)
                local onlineUsername = callValue(onlinePlayer, "getUsername")

                if okPlayer and onlinePlayer and onlinePlayer ~= localPlayer and (not localUsername or onlineUsername ~= localUsername) then
                    addPlayer(players, seenIds, onlinePlayer, false)
                end
            end
        end
    end

    if PZMapSync.RemotePlayers and PZMapSync.RemotePlayers.getPlayers then
        local serverPlayers = PZMapSync.RemotePlayers.getPlayers(localPlayer)
        for _, remotePlayer in ipairs(serverPlayers) do
            if remotePlayer.id and not seenIds[remotePlayer.id] then
                seenIds[remotePlayer.id] = true
                players[#players + 1] = remotePlayer
            end
        end
    end

    return players
end

local function buildSnapshot(player, timestampMs)
    Client.sequence = Client.sequence + 1
    local markerProbe = PZMapSync.MapMarkers.probe(timestampMs)

    return {
        schemaVersion = PZMapSync.Config.SchemaVersion,
        sequence = Client.sequence,
        game = {
            build = getCore and tostring(getCore():getVersion()) or nil,
            world = saveName()
        },
        writtenAt = timestampMs,
        players = buildPlayers(player),
        markers = PZMapSync.MapMarkers.getMarkers(timestampMs),
        markerProbe = markerProbe
    }
end

function Client.onPlayerUpdate(player)
    if not player then
        return
    end

    local timestampMs = nowMs()
    if timestampMs - Client.lastWriteAt < PZMapSync.Config.WriteIntervalMs then
        return
    end

    Client.lastWriteAt = timestampMs
    local snapshot = buildSnapshot(player, timestampMs)

    if PZMapSync.Writer.writeSnapshot(snapshot) and not Client.wroteFirstSnapshot then
        Client.wroteFirstSnapshot = true
        log("Version " .. versionLabel() .. " writing snapshots to " .. PZMapSync.Config.OutputFile)
    end
end

Events.OnPlayerUpdate.Add(Client.onPlayerUpdate)

PZMapSync.Client = Client
