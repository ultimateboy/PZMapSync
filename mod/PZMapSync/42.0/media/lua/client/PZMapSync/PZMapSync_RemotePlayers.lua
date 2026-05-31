require "PZMapSync/PZMapSync_Config"

PZMapSync = PZMapSync or {}

local RemotePlayers = {
    players = {},
    updatedAt = 0
}

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

local function localUsernameOf(localPlayer)
    local username = callValue(localPlayer, "getUsername")
    if username and username ~= "" then
        return tostring(username)
    end

    return nil
end

function RemotePlayers.onServerCommand(module, command, args)
    if module ~= PZMapSync.Config.ModId or command ~= "allPlayers" then
        return
    end

    RemotePlayers.updatedAt = nowMs()
    RemotePlayers.players = args and args.players or {}
end

function RemotePlayers.getPlayers(localPlayer)
    if nowMs() - RemotePlayers.updatedAt > PZMapSync.Config.AllPlayersStaleMs then
        return {}
    end

    local localUsername = localUsernameOf(localPlayer)
    local players = {}

    for _, player in ipairs(RemotePlayers.players) do
        if player and player.username ~= localUsername then
            players[#players + 1] = {
                id = player.id,
                name = player.name or player.username or "Player",
                username = player.username,
                x = player.x,
                y = player.y,
                z = player.z,
                direction = player.direction,
                localPlayer = false,
                source = "server"
            }
        end
    end

    return players
end

Events.OnServerCommand.Add(RemotePlayers.onServerCommand)

PZMapSync.RemotePlayers = RemotePlayers
