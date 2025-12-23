<?php
require 'login.php';

if (array_key_exists('push',$_REQUEST))	{	// Master mode, updates database with new hash
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	if (!pg_meta_data($dbconn,'slides')) {
		$query="create table slides (name varchar(30) primary key, hash varchar(50), interactive text)";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace function notify_slides() returns trigger as $$
			begin
				perform pg_notify(old.name,new.hash);
				return new;
			end;
			$$ language plpgsql;";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create trigger notify_update after update on slides for each row execute procedure notify_slides()";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
	}
	if (!array_key_exists('interactive', $_REQUEST)) $_REQUEST["interactive"]="";
	$query="insert into slides values ($1, $2, $3) on conflict(name) do update set hash=EXCLUDED.hash, interactive=EXCLUDED.interactive";
	$result=pg_query_params($dbconn, $query, array($_REQUEST['push'], $_REQUEST['hash'], $_REQUEST['interactive'])) or die('Request failed: '.pg_last_error());
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('register',$_REQUEST)) {	// Slave mode with HTML5 server-sent events, connection kept alive, changes in database are immediatly sent to client
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	ob_end_clean();
	$query='listen '.pg_escape_identifier($dbconn, $_REQUEST['register']);
	$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	do {
		$notify=pg_get_notify($dbconn,PGSQL_ASSOC);
		if ($notify) {
			echo 'data: '.$notify['payload'].PHP_EOL;
			echo PHP_EOL;
			flush();
		}
		sleep(1);
	} while (true);
	pg_close($dbconn);
} elseif (array_key_exists('pull',$_REQUEST)) {	// Slave mode with no HTML5 server-sent events, client has to poll at regular intervals
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	$query="select hash from slides where name=$1";
	$result=pg_query_params($dbconn, $query, array($_REQUEST['pull'])) or die('Request failed: '.pg_last_error());
	$val=pg_fetch_array($result,null,PGSQL_ASSOC);
	if ($val) echo $val['hash'];
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('wait', $_REQUEST)) {	// Goes into waiting mode for interactive slideshows
	echo <<<END
	<!DOCTYPE html>
	<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
	END;
	if (array_key_exists('css', $_REQUEST)) echo '<link rel="stylesheet" href="'.$_REQUEST["css"].'">';
	echo <<<END
		<script src="sync.js"></script>
	</head>
	<body>
	</body>
	</html>
	END;
} elseif (array_key_exists('subscribe', $_REQUEST)) {	// Subscribe to server-sent events for new polls
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	ob_end_clean();
	$query='listen '.pg_escape_identifier($dbconn, $_REQUEST['subscribe']);
	$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	do {
		$notify=pg_get_notify($dbconn,PGSQL_NUM);
		if ($notify) {
			$query="select interactive from slides where name=$1";
			$res=pg_query_params($dbconn, $query, array($_REQUEST['subscribe'])) or die('Request failed: '.pg_last_error());
			$val=pg_fetch_array($res,null,PGSQL_ASSOC);
			pg_free_result($res);
			if ($val) {
				$arr = explode("\n", $val['interactive']);
				foreach ($arr as $line) echo 'data: '.$line.PHP_EOL;
				echo PHP_EOL;
				flush();
			}
		}
		sleep(1);
	} while (true);
	pg_close($dbconn);
} elseif (array_key_exists('submit', $_REQUEST) && array_key_exists('poll', $_REQUEST)) {	// Submit an answer to a poll
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	if (!pg_meta_data($dbconn,'polls')) {
		$query="create table polls (name varchar(30), poll text, answer text)";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace function notify_polls() returns trigger as $$
			begin
				perform pg_notify(new.poll,new.answer);
				return new;
			end;
			$$ language plpgsql;";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
		$query="create trigger notify_update after insert on polls for each row execute procedure notify_polls()";
		$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
		pg_free_result($result);
	}
	$query="insert into polls values ($1, $2, $3)";
	$result=pg_query_params($dbconn, $query, array($_REQUEST['submit'], $_REQUEST['poll'], $_REQUEST['answer'])) or die('Request failed: '.pg_last_error());
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('follow', $_REQUEST) && array_key_exists('poll', $_REQUEST)) {	// Get events for updates on a poll
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	ob_end_clean();
	$query='listen '.pg_escape_identifier($dbconn, $_REQUEST['follow']);
	$result=pg_query($dbconn, $query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	do {
		$notify=pg_get_notify($dbconn,PGSQL_NUM);
		if ($notify) {
			$query="select answer, count(poll) as number from slides where name=$1 and poll=$2 group by answer";
			$res=pg_query_params($dbconn, $query, answer($_REQUEST['follow'], $_REQUEST['poll'])) or die('Request failed: '.pg_last_error());
			$ret=pg_fetch_all($res, PGSQL_ASSOC);
			pg_free_result($res);
			if ($ret) {
				echo "data: ".json_encode($ret).PHP_EOL;
				echo PHP_EOL;
				flush();
			}
		}
		sleep(1);
	} while (true);
	pg_close($dbconn);
} 
?>
